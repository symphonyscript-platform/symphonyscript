use crate::constants::SYNAPSE_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::synapse::synapse_writer::SynapseWriter;
use std::sync::Arc;

#[derive(Clone)]
pub struct SynapseChainWriter<const NODE_META_SIZE: usize, const SYNAPSE_META_SIZE: usize> {
    triple_buffer: TripleBufferWriter,
    node_chain: NodeChainWriter<NODE_META_SIZE>,
    allocator: SlotAllocator,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const NODE_META_SIZE: usize, const SYNAPSE_META_SIZE: usize>
    SynapseChainWriter<NODE_META_SIZE, SYNAPSE_META_SIZE>
{
    pub fn new(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_SIZE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            node_chain,
            mem_start_offset,
            tb_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_SIZE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            node_chain,
            mem_start_offset,
            tb_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        triple_buffer: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_SIZE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            tb_start_offset < triple_buffer.buffer_capacity(),
            "SynapseChainWriter::create | tb_start_offset {} out of bounds",
            tb_start_offset,
        );

        let allocator = SlotAllocator::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let mem_end_offset = allocator.mem_end_offset();
        let tb_end_offset = tb_start_offset + Self::calculate_size_on_tb(capacity);

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "SynapseChainWriter::create | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        SynapseChainWriter {
            triple_buffer,
            node_chain,
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
        capacity * (SYNAPSE_SIZE + SYNAPSE_META_SIZE)
    }

    pub(crate) fn calculate_synapse_start_offset(tb_start_offset: usize, slot: usize) -> usize {
        tb_start_offset + (slot - 1) * (SYNAPSE_SIZE + SYNAPSE_META_SIZE)
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

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_, SYNAPSE_META_SIZE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "SynapseChainWriter.get | attempted to read inactive slot {}",
            slot
        );
        let start_offset = Self::calculate_synapse_start_offset(self.tb_start_offset, slot);
        SynapseWriter::new(&self.triple_buffer, start_offset)
    }

    pub fn connect(&self, source_slot: usize, target_slot: usize, kind: i32) -> Option<usize> {
        let source = self.node_chain.get_node(source_slot);
        let target = self.node_chain.get_node(target_slot);
        let source_current_tail_ptr = source.get_outgoing_synapse_tail();
        let target_current_tail_ptr = target.get_incoming_synapse_tail();
        let result = self.allocator.alloc();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let start_offset = Self::calculate_synapse_start_offset(self.tb_start_offset, new_slot);

        for i in 0..SYNAPSE_SIZE + SYNAPSE_META_SIZE {
            self.triple_buffer.write(start_offset + i, 0)
        }

        let synapse = self.get_synapse(new_slot);

        synapse.set_kind(kind);
        synapse.set_source_ptr(source_slot);
        synapse.set_target_ptr(target_slot);
        synapse.set_outgoing_next_ptr(0);
        synapse.set_outgoing_prev_ptr(source_current_tail_ptr);
        synapse.set_incoming_next_ptr(0);
        synapse.set_incoming_prev_ptr(target_current_tail_ptr);

        if source.get_outgoing_synapse_head() == 0 {
            source.set_outgoing_synapse_head(new_slot);
        }

        if target.get_incoming_synapse_head() == 0 {
            target.set_incoming_synapse_head(new_slot);
        }

        if source_current_tail_ptr != 0 {
            self.get_synapse(source_current_tail_ptr)
                .set_outgoing_next_ptr(new_slot);
        }

        if target_current_tail_ptr != 0 {
            self.get_synapse(target_current_tail_ptr)
                .set_incoming_next_ptr(new_slot);
        }

        source.set_outgoing_synapse_tail(new_slot);
        target.set_incoming_synapse_tail(new_slot);

        Some(new_slot)
    }

    pub fn disconnect(&self, slot: usize) -> Result<(), FreeListError> {
        let synapse = self.get_synapse(slot);
        let source = self.node_chain.get_node(synapse.get_source_ptr());
        let target = self.node_chain.get_node(synapse.get_target_ptr());
        let synapse_outgoing_next_ptr = synapse.get_outgoing_next_ptr();
        let synapse_outgoing_prev_ptr = synapse.get_outgoing_prev_ptr();
        let synapse_incoming_next_ptr = synapse.get_incoming_next_ptr();
        let synapse_incoming_prev_ptr = synapse.get_incoming_prev_ptr();

        self.allocator.defer_free(slot)?;

        if synapse_outgoing_prev_ptr != 0 {
            self.get_synapse(synapse_outgoing_prev_ptr)
                .set_outgoing_next_ptr(synapse_outgoing_next_ptr);
        } else {
            source.set_outgoing_synapse_head(synapse_outgoing_next_ptr);
        }

        if synapse_outgoing_next_ptr != 0 {
            self.get_synapse(synapse_outgoing_next_ptr)
                .set_outgoing_prev_ptr(synapse_outgoing_prev_ptr);
        } else {
            source.set_outgoing_synapse_tail(synapse_outgoing_prev_ptr);
        }

        if synapse_incoming_prev_ptr != 0 {
            self.get_synapse(synapse_incoming_prev_ptr)
                .set_incoming_next_ptr(synapse_incoming_next_ptr);
        } else {
            target.set_incoming_synapse_head(synapse_incoming_next_ptr);
        }

        if synapse_incoming_next_ptr != 0 {
            self.get_synapse(synapse_incoming_next_ptr)
                .set_incoming_prev_ptr(synapse_incoming_prev_ptr);
        } else {
            target.set_incoming_synapse_tail(synapse_incoming_prev_ptr);
        }

        Ok(())
    }

    pub fn flush_deferred(&mut self) {
        self.allocator.flush_deferred()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "SynapseChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
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
}
