use crate::constants::{NODE_META_BASE_TICK, NODE_META_MOD_HEAD};
use crate::symphony_engine::SymphonyEngine;
use synaptic_kernel::errors::slot_allocator_error::SlotAllocatorError;

pub trait NodeOperations {
    fn get_node_kind(&self, node: usize) -> i32;
    fn get_node_base_tick(&self, node: usize) -> i32;

    fn get_node_next(&self, node: usize) -> usize;
    fn get_node_prev(&self, node: usize) -> usize;

    fn get_node_outgoing_synapse_head(&self, node: usize) -> usize;
    fn get_node_outgoing_synapse_tail(&self, node: usize) -> usize;

    fn get_node_incoming_synapse_head(&self, node: usize) -> usize;
    fn get_node_incoming_synapse_tail(&self, node: usize) -> usize;

    fn get_node_modulation_head(&self, node: usize) -> usize;
    fn set_node_modulation_head(&self, node: usize, value: usize);

    fn remove_node(&self, node: usize) -> Result<(), SlotAllocatorError>;
}

impl NodeOperations for SymphonyEngine {
    fn get_node_kind(&self, node: usize) -> i32 {
        self.kernel.get_node(node).get_kind()
    }

    fn get_node_base_tick(&self, node: usize) -> i32 {
        self.kernel.get_node(node).get_meta(NODE_META_BASE_TICK)
    }

    fn get_node_next(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_next_ptr()
    }

    fn get_node_prev(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_prev_ptr()
    }

    fn get_node_outgoing_synapse_head(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_outgoing_synapse_head()
    }

    fn get_node_outgoing_synapse_tail(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_outgoing_synapse_tail()
    }

    fn get_node_incoming_synapse_head(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_incoming_synapse_head()
    }

    fn get_node_incoming_synapse_tail(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_incoming_synapse_tail()
    }

    fn get_node_modulation_head(&self, node: usize) -> usize {
        self.kernel.get_node(node).get_meta(NODE_META_MOD_HEAD) as usize
    }

    fn set_node_modulation_head(&self, node: usize, value: usize) {
        self.kernel
            .get_node(node)
            .set_meta(NODE_META_MOD_HEAD, value as i32)
    }

    fn remove_node(&self, node: usize) -> Result<(), SlotAllocatorError> {
        self.kernel.remove_node(node)
    }
}
