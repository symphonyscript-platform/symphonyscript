use crate::constants::NODE_STRIDE;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::entry_store_writer::EntryStoreWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_view::NodeView;
use crate::topology::node::node_writer::NodeWriter;

/// Producer-side triple-buffered doubly-linked list for graph nodes.
///
/// Orchestrates allocation, lifecycle, and structural linkage of nodes.
///
/// Uses `SlotAllocator` to manage node slot lifecycles.
///
/// # Threading
/// Producer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// ```text
/// Offset      Size        Field
/// -------------------------------------
/// 0           1           head_slot
/// 1           N*(S+M)     nodes
///
/// N = capacity
/// S = NODE_STRIDE (8)
/// M = META_STRIDE (const generic)
/// ```
///
/// # Constraints
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Built-in lifecycle safety: `remove()` marks the slot for deferred freeing,
///   preventing reallocation until the consumer has advanced past the pending `publish()`.
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

    pub(crate) fn calculate_node_start_offset(tb_head_offset: usize, slot: usize) -> usize {
        tb_head_offset + 1 + (slot - 1) * (NODE_STRIDE + META_STRIDE)
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
    pub fn get_head_node_view(&'_ self) -> Option<NodeView<'_, META_STRIDE, ATTR_STRIDE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node_view(head_slot))
    }

    #[inline]
    pub fn get_node_view(&'_ self, slot: usize) -> NodeView<'_, META_STRIDE, ATTR_STRIDE> {
        NodeView::new(self.nodes.get_view(slot))
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
