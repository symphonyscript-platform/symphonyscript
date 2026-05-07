use crate::constants::BOUNDARY_ATTR_ID;
use crate::symphony_engine::SymphonyEngine;

pub trait BoundaryOperations {
    fn get_boundary_id(&self, node: usize) -> i32;
    fn set_boundary_id(&self, node: usize, value: i32);
}

impl BoundaryOperations for SymphonyEngine {
    #[inline]
    fn get_boundary_id(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(BOUNDARY_ATTR_ID)
    }

    #[inline]
    fn set_boundary_id(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(BOUNDARY_ATTR_ID, value);
    }
}
