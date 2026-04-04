use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
use crate::structural_plane::structural_writer::StructuralWriter;
use crate::structural_plane::synapse::synapse_data::{SynapseData, SynapseDraft};
use crate::structural_plane::synapse::synapse_writer::SynapseWriter;

#[derive(Clone)]
pub struct SynapseChainWriter {
    node_chain: NodeChainWriter,
    synapse_writer: StructuralWriter<SYNAPSE_SLOT_SIZE>,
    sab_start_index: usize,
    sab_end_index: usize,
    triple_buffer_start_offset: usize,
    triple_buffer_end_offset: usize,
    capacity: usize,
}

impl SynapseChainWriter {
    pub fn new(
        sab: SAB,
        buffer: TripleBufferWriter,
        node_chain: NodeChainWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            sab,
            buffer,
            node_chain,
            sab_start_index,
            triple_buffer_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        sab: SAB,
        buffer: TripleBufferWriter,
        node_chain: NodeChainWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            sab,
            buffer,
            node_chain,
            sab_start_index,
            triple_buffer_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        sab: SAB,
        buffer: TripleBufferWriter,
        node_chain: NodeChainWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            triple_buffer_start_offset < buffer.buffer_capacity(),
            "SynapseChainWriter::create | triple_buffer_start_offset {} out of bounds",
            triple_buffer_start_offset,
        );

        let synapse_writer = StructuralWriter::<SYNAPSE_SLOT_SIZE>::create(
            sab,
            buffer.clone(),
            sab_start_index,
            triple_buffer_start_offset,
            capacity,
            bind,
        );
        let sab_end_index = synapse_writer.sab_end_index();
        let triple_buffer_end_offset = synapse_writer.triple_buffer_end_offset();

        debug_assert!(
            triple_buffer_end_offset <= buffer.buffer_capacity(),
            "SynapseChainWriter::create | triple_buffer_end_offset {} out of bounds",
            triple_buffer_end_offset,
        );

        SynapseChainWriter {
            node_chain,
            synapse_writer,
            sab_start_index,
            sab_end_index,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn compute_size_on_sab(capacity: usize) -> usize {
        StructuralWriter::<SYNAPSE_SLOT_SIZE>::compute_size_on_sab(capacity)
    }

    pub fn compute_size_on_triple_buffer(capacity: usize) -> usize {
        StructuralWriter::<SYNAPSE_SLOT_SIZE>::compute_size_on_triple_buffer(capacity)
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn triple_buffer_start_offset(&self) -> usize {
        self.triple_buffer_start_offset
    }

    pub fn triple_buffer_end_offset(&self) -> usize {
        self.triple_buffer_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn count(&self) -> usize {
        self.synapse_writer.count()
    }

    pub fn utilization(&self) -> f32 {
        self.synapse_writer.utilization()
    }

    pub fn is_active_slot(&self, slot: usize) -> bool {
        self.synapse_writer.is_active_slot(slot)
    }

    pub fn get(&'_ self, slot: usize) -> SynapseWriter<'_> {
        SynapseWriter(self.synapse_writer.get(slot))
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        data: SynapseDraft,
    ) -> Option<usize> {
        let source = self.node_chain.get(source_slot);
        let target = self.node_chain.get(target_slot);
        let source_current_tail_ptr = source.get_outgoing_synapse_tail();
        let target_current_tail_ptr = target.get_incoming_synapse_tail();
        let result = self.synapse_writer.insert(SynapseData {
            opcode: data.opcode,
            source_ptr: source_slot,
            target_ptr: target_slot,
            outgoing_next_ptr: 0,
            outgoing_prev_ptr: source_current_tail_ptr,
            incoming_next_ptr: 0,
            incoming_prev_ptr: target_current_tail_ptr,
        });

        match result {
            Some(new_slot) => {
                if source.get_outgoing_synapse_head() == 0 {
                    source.set_outgoing_synapse_head(new_slot);
                }

                if target.get_incoming_synapse_head() == 0 {
                    target.set_incoming_synapse_head(new_slot);
                }

                if source_current_tail_ptr != 0 {
                    self.get(source_current_tail_ptr)
                        .set_outgoing_next_ptr(new_slot);
                }

                if target_current_tail_ptr != 0 {
                    self.get(target_current_tail_ptr)
                        .set_incoming_next_ptr(new_slot);
                }

                source.set_outgoing_synapse_tail(new_slot);
                target.set_incoming_synapse_tail(new_slot);

                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn disconnect(&self, slot: usize) -> Result<(), FreeListError> {
        let synapse = self.get(slot);
        let source = self.node_chain.get(synapse.get_source_ptr());
        let target = self.node_chain.get(synapse.get_target_ptr());
        let synapse_outgoing_next_ptr = synapse.get_outgoing_next_ptr();
        let synapse_outgoing_prev_ptr = synapse.get_outgoing_prev_ptr();
        let synapse_incoming_next_ptr = synapse.get_incoming_next_ptr();
        let synapse_incoming_prev_ptr = synapse.get_incoming_prev_ptr();

        self.synapse_writer.defer_free(slot)?;

        if synapse_outgoing_prev_ptr != 0 {
            self.get(synapse_outgoing_prev_ptr)
                .set_outgoing_next_ptr(synapse_outgoing_next_ptr);
        } else {
            source.set_outgoing_synapse_head(synapse_outgoing_next_ptr);
        }

        if synapse_outgoing_next_ptr != 0 {
            self.get(synapse_outgoing_next_ptr)
                .set_outgoing_prev_ptr(synapse_outgoing_prev_ptr);
        } else {
            source.set_outgoing_synapse_tail(synapse_outgoing_prev_ptr);
        }

        if synapse_incoming_prev_ptr != 0 {
            self.get(synapse_incoming_prev_ptr)
                .set_incoming_next_ptr(synapse_incoming_next_ptr);
        } else {
            target.set_incoming_synapse_head(synapse_incoming_next_ptr);
        }

        if synapse_incoming_next_ptr != 0 {
            self.get(synapse_incoming_next_ptr)
                .set_incoming_prev_ptr(synapse_incoming_prev_ptr);
        } else {
            target.set_incoming_synapse_tail(synapse_incoming_prev_ptr);
        }

        Ok(())
    }

    pub fn flush_deferred(&mut self) {
        self.synapse_writer.flush_deferred()
    }

    pub fn copy_from(&self, source: &SynapseChainWriter) {
        debug_assert!(
            source.capacity <= self.capacity,
            "SynapseChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );
        self.synapse_writer.copy_from(&source.synapse_writer);
    }
}
