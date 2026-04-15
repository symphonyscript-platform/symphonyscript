use crate::constants::BOUNDARY_ATTR_ID;
use crate::symphony_engine::SymphonyEngine;

pub trait BoundaryOperations {
    fn get_boundary_id(&self, node: usize) -> i32;
    fn set_boundary_id(&self, node: usize, value: i32);
}

impl BoundaryOperations for SymphonyEngine {
    fn get_boundary_id(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, BOUNDARY_ATTR_ID)
    }

    fn set_boundary_id(&self, node: usize, value: i32) {
        self.kernel
            .set_node_attribute(node, BOUNDARY_ATTR_ID, value);
    }
}
