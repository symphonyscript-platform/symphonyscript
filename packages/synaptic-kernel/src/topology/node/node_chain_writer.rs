use crate::constants::NODE_SIZE;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::staging_buffer_reader::StagingBufferReader;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_writer::NodeWriter;
use std::sync::Arc;

/// Writer side triple-buffered doubly-linked list for graph nodes.
///
/// Orchestrates allocation, lifecycle, and structural linkage of nodes.
///
/// # Threading
/// Producer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// ```text
/// Offset          Size        Field
/// -------------------------------------
/// 0               1           head_slot
/// N * (S + M)     S + M       nodes
///
/// N = capacity
/// S = NODE_SIZE (8)
/// M = META_SIZE (const generic)
/// ```
///
/// # Constraints
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Built-in lifecycle safety: `remove()` marks the slot for deferred freeing,
///   preventing reallocation until the consumer has advanced pas the pending `publish()`.
/// - Use `to_reader()` to create the paired `NodeChainReader`.
#[derive(Clone)]
pub struct NodeChainWriter<const META_SIZE: usize> {
    triple_buffer: TripleBufferWriter,
    allocator: SlotAllocator,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const META_SIZE: usize> NodeChainWriter<META_SIZE> {
    pub fn new(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        triple_buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            tb_start_offset < triple_buffer.buffer_capacity(),
            "NodeChainWriter::create | tb_start_offset {} out of bounds",
            tb_start_offset,
        );

        let allocator = SlotAllocator::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let mem_end_offset = allocator.mem_end_offset();
        let tb_end_offset = tb_start_offset + Self::calculate_size_on_tb(capacity);

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "NodeChainWriter::create | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        NodeChainWriter {
            triple_buffer,
            allocator,
            mem_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        SlotAllocator::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        1 + capacity * (NODE_SIZE + META_SIZE)
    }

    pub(crate) fn calculate_node_start_offset(tb_start_offset: usize, slot: usize) -> usize {
        tb_start_offset + 1 + (slot - 1) * (NODE_SIZE + META_SIZE)
    }

    pub fn to_reader(&self) -> NodeChainReader<META_SIZE> {
        NodeChainReader::bind(
            self.triple_buffer.to_reader(),
            self.tb_start_offset,
            self.capacity,
        )
    }

    pub fn to_staging_buffer_reader(&self) -> StagingBufferReader {
        self.allocator.to_staging_buffer_reader()
    }

    pub fn len(&self) -> usize {
        self.allocator.alloc_count()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn mem_staging_buffer_start_offset(&self) -> usize {
        self.allocator.mem_staging_buffer_start_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn utilization(&self) -> f32 {
        self.allocator.utilization()
    }

    pub fn is_active_slot(&self, slot: usize) -> bool {
        self.allocator.is_active(slot)
    }

    pub fn get_head_slot(&self) -> usize {
        self.triple_buffer.read(self.tb_start_offset) as usize
    }

    pub fn get_head(&'_ self) -> Option<NodeWriter<'_, META_SIZE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node(head_slot))
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_, META_SIZE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "NodeChainWriter.get | attempted to read inactive slot {}",
            slot
        );
        let start_offset = Self::calculate_node_start_offset(self.tb_start_offset, slot);
        NodeWriter::new(&self.triple_buffer, start_offset)
    }

    pub fn insert_head(&self, kind: i32) -> Option<usize> {
        let current_head_slot = self.triple_buffer.read(self.tb_start_offset);
        let result = self.insert_orphaned(kind, current_head_slot as usize, 0);

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();

        if current_head_slot != 0 {
            self.get_node(current_head_slot as usize)
                .set_prev_ptr(new_slot);
        }

        self.triple_buffer
            .write(self.tb_start_offset, new_slot as i32);

        Some(new_slot)
    }

    pub fn insert_after(&self, prev_slot: usize, kind: i32) -> Option<usize> {
        let prev = self.get_node(prev_slot);
        let prev_next_slot = prev.get_next_ptr();
        let result = self.insert_orphaned(kind, prev_next_slot, prev_slot);

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

    pub fn insert_before(&self, next_slot: usize, kind: i32) -> Option<usize> {
        let next = self.get_node(next_slot);
        let next_prev_slot = next.get_prev_ptr();
        let result = self.insert_orphaned(kind, next_slot, next_prev_slot);

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();

        next.set_prev_ptr(new_slot);

        if next_prev_slot != 0 {
            self.get_node(next_prev_slot).set_next_ptr(new_slot);
        } else {
            self.triple_buffer
                .write(self.tb_start_offset, new_slot as i32);
        }

        Some(new_slot)
    }

    pub fn remove(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        let node = self.get_node(slot);
        let prev_slot = node.get_prev_ptr();
        let next_slot = node.get_next_ptr();

        self.allocator.defer_free(slot)?;

        if prev_slot != 0 {
            self.get_node(prev_slot).set_next_ptr(next_slot);
        } else {
            self.triple_buffer
                .write(self.tb_start_offset, next_slot as i32)
        }

        if next_slot != 0 {
            self.get_node(next_slot).set_prev_ptr(prev_slot);
        }

        Ok(())
    }

    pub fn publish(&self) {
        self.allocator.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "NodeChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.allocator.copy_from(&source.allocator);
        self.triple_buffer.copy_region_from(
            &source.triple_buffer,
            source.tb_start_offset,
            self.tb_start_offset,
            Self::calculate_size_on_tb(source.capacity),
        );
    }

    fn insert_orphaned(&self, kind: i32, next_ptr: usize, prev_ptr: usize) -> Option<usize> {
        let result = self.allocator.alloc();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let start_offset = Self::calculate_node_start_offset(self.tb_start_offset, new_slot);

        for i in 0..NODE_SIZE + META_SIZE {
            self.triple_buffer.write(start_offset + i, 0)
        }

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
