use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
use crate::structural_plane::structural_writer::StructuralWriter;
use crate::structural_plane::synapse::synapse_data::{SynapseData, SynapseDraft};
use crate::structural_plane::synapse::synapse_writer::SynapseWriter;

#[derive(Clone)]
pub struct SynapseChainWriter {
    node_chain: NodeChainWriter,
    synapse_writer: StructuralWriter<SYNAPSE_SLOT_SIZE>,
}

impl SynapseChainWriter {
    pub fn new(
        node_chain: NodeChainWriter,
        synapse_writer: StructuralWriter<SYNAPSE_SLOT_SIZE>,
    ) -> Self {
        SynapseChainWriter {
            node_chain,
            synapse_writer,
        }
    }

    pub fn bind(
        node_chain: NodeChainWriter,
        synapse_writer: StructuralWriter<SYNAPSE_SLOT_SIZE>,
    ) -> Self {
        Self::new(node_chain, synapse_writer)
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

        self.synapse_writer.free(slot)
    }
}
