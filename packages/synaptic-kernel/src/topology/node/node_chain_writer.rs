use crate::constants::NODE_STRIDE;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::entry_store_writer::EntryStoreWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_handle::NodeHandle;
use crate::topology::node::node_writer::NodeWriter;

/// Producer-side doubly-linked list of nodes.
///
/// Owns an internal `EntryStoreWriter<...>` for slot allocation and per-slot storage
/// (core + meta zones in TB, attributes on the MEM). Adds a single head-slot pointer at TB
/// offset 0 and maintains `next_ptr` / `prev_ptr` inside each node's core zone to form the chain.
///
/// # Threading
/// Producer thread only.
///
/// # Memory Layout (MEM plane)
/// ```text
/// Order       Segment             Size
/// -------------------------------------
/// 1           Slot Allocator      SlotAllocator::calculate_size_on_mem()
/// 2           Node Attributes     capacity * ATTR_STRIDE
/// ```
///
/// # Memory Layout (TB plane)
/// ```text
/// Offset      Size            Field
/// -------------------------------------
/// 0           1               head_slot
/// 1           C * (N + M)     nodes (core + meta pers slot)
///
/// C = capacity
/// N = NODE_STRIDE
/// M = META_STRIDE
/// ```
///
/// Each node's core and meta zones are adjacent per slot - see `NodeWriter`
/// for the exact core field layout.
///
/// # Scope
/// This type manages only the node chain. `remove_node()` unlinks the node
/// from the chain and defers its slot removal, but does NOT touch any synapses
/// that reference the removed node. If the graph has active synapses,
/// use `NetworkWriter::remove_node()` instead - it cascades synapse cleanup before
/// invoking this.
///
/// # Constraints
/// - Slots are 1-based. 0 denotes "no slot" / "undefined".
/// - Lifecycle safety: `remove_node()` marks the slot for deferred freeing, preventing
///   reallocation until the consumer has advanced past the pending `publish()`.
/// - Use `to_reader()` to create the paired `NodeChainReader`.
#[derive(Clone)]
pub struct NodeChainWriter<const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    tb: TripleBufferWriter,
    pub(crate) nodes: EntryStoreWriter<NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
    tb_head_offset: usize,
}

impl<const META_STRIDE: usize, const ATTR_STRIDE: usize> NodeChainWriter<META_STRIDE, ATTR_STRIDE> {
    pub fn new(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(mem, tb, mem_start_offset, tb_start_offset, capacity, false)
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(mem, tb, mem_start_offset, tb_start_offset, capacity, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        NodeChainWriter {
            tb: tb.clone(),
            nodes: EntryStoreWriter::create(
                mem,
                tb,
                mem_start_offset,
                tb_start_offset + 1,
                capacity,
                bind,
            ),
            tb_head_offset: tb_start_offset,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        EntryStoreWriter::<NODE_STRIDE, META_STRIDE, ATTR_STRIDE>::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        1 + EntryStoreWriter::<NODE_STRIDE, META_STRIDE, ATTR_STRIDE>::calculate_size_on_tb(
            capacity,
        )
    }

    pub fn to_reader(&self) -> NodeChainReader<META_STRIDE, ATTR_STRIDE> {
        NodeChainReader::bind(
            self.tb.to_reader(),
            self.nodes.to_reader(),
            self.tb_head_offset,
        )
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.nodes.mem_start_offset()
    }

    pub fn mem_end_offset(&self) -> usize {
        self.nodes.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_head_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.nodes.tb_end_offset()
    }

    pub fn capacity(&self) -> usize {
        self.nodes.capacity()
    }

    pub fn utilization(&self) -> f32 {
        self.nodes.utilization()
    }

    #[inline]
    pub fn get_head_slot(&self) -> usize {
        self.tb.read(self.tb_head_offset) as usize
    }

    #[inline]
    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_, META_STRIDE, ATTR_STRIDE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node(head_slot))
    }

    #[inline]
    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_, META_STRIDE, ATTR_STRIDE> {
        NodeWriter::new(self.nodes.get(slot))
    }

    #[inline]
    pub fn get_head_node_handle(&'_ self) -> Option<NodeHandle<'_, META_STRIDE, ATTR_STRIDE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node_handle(head_slot))
    }

    #[inline]
    pub fn get_node_handle(&'_ self, slot: usize) -> NodeHandle<'_, META_STRIDE, ATTR_STRIDE> {
        NodeHandle::new(self.nodes.get_handle(slot))
    }

    pub fn insert_head_node(&self, kind: i32) -> Option<usize> {
        let current_head_slot = self.tb.read(self.tb_head_offset);
        let result = self.insert_orphaned_node(kind, current_head_slot as usize, 0);

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();

        if current_head_slot != 0 {
            self.get_node(current_head_slot as usize)
                .set_prev_ptr(new_slot);
        }

        self.tb.write(self.tb_head_offset, new_slot as i32);

        Some(new_slot)
    }

    pub fn insert_node_after(&self, prev_slot: usize, kind: i32) -> Option<usize> {
        let prev = self.get_node(prev_slot);
        let prev_next_slot = prev.get_next_ptr();
        let result = self.insert_orphaned_node(kind, prev_next_slot, prev_slot);

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();

        prev.set_next_ptr(new_slot);

        if prev_next_slot != 0 {
            self.get_node(prev_next_slot).set_prev_ptr(new_slot);
        }

        Some(new_slot)
    }

    pub fn insert_node_before(&self, next_slot: usize, kind: i32) -> Option<usize> {
        let next = self.get_node(next_slot);
        let next_prev_slot = next.get_prev_ptr();
        let result = self.insert_orphaned_node(kind, next_slot, next_prev_slot);

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();

        next.set_prev_ptr(new_slot);

        if next_prev_slot != 0 {
            self.get_node(next_prev_slot).set_next_ptr(new_slot);
        } else {
            self.tb.write(self.tb_head_offset, new_slot as i32);
        }

        Some(new_slot)
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        let node = self.get_node(slot);
        let prev_slot = node.get_prev_ptr();
        let next_slot = node.get_next_ptr();

        self.nodes.remove(slot)?;

        if prev_slot != 0 {
            self.get_node(prev_slot).set_next_ptr(next_slot);
        } else {
            self.tb.write(self.tb_head_offset, next_slot as i32)
        }

        if next_slot != 0 {
            self.get_node(next_slot).set_prev_ptr(prev_slot);
        }

        Ok(())
    }

    pub fn publish(&self) {
        self.nodes.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity() <= self.capacity(),
            "NodeChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity(),
            self.capacity(),
        );

        self.tb
            .copy_region_from(&source.tb, source.tb_head_offset, self.tb_head_offset, 1);
        self.nodes.copy_from(&source.nodes);
    }

    fn insert_orphaned_node(&self, kind: i32, next_ptr: usize, prev_ptr: usize) -> Option<usize> {
        let result = self.nodes.insert();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let node = self.get_node(new_slot);

        node.set_kind(kind);
        node.set_next_ptr(next_ptr);
        node.set_prev_ptr(prev_ptr);
        node.set_outgoing_synapse_head(0);
        node.set_outgoing_synapse_tail(0);
        node.set_incoming_synapse_head(0);
        node.set_incoming_synapse_tail(0);

        Some(new_slot)
    }
}
