use crate::constants::BARRIER_ATTR_PHASE_TARGET;
use crate::symphony_engine::SymphonyEngine;

pub trait BarrierOperations {
    fn get_barrier_phase_target(&self, node: usize) -> i32;
    fn set_barrier_phase_target(&self, node: usize, value: i32);
}

impl BarrierOperations for SymphonyEngine {
    fn get_barrier_phase_target(&self, node: usize) -> i32 {
        self.kernel
            .get_node_attribute(node, BARRIER_ATTR_PHASE_TARGET)
    }

    fn set_barrier_phase_target(&self, node: usize, value: i32) {
        self.kernel
            .set_node_attribute(node, BARRIER_ATTR_PHASE_TARGET, value);
    }
}
