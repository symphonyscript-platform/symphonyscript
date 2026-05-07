use crate::constants::{CONTROL_ATTR_ID, CONTROL_ATTR_VALUE};
use crate::symphony_engine::SymphonyEngine;

pub trait ControlOperations {
    fn get_control_id(&self, node: usize) -> i32;
    fn set_control_id(&self, node: usize, value: i32);

    fn get_control_value(&self, node: usize) -> i32;
    fn set_control_value(&self, node: usize, value: i32);
}

impl ControlOperations for SymphonyEngine {
    #[inline]
    fn get_control_id(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(CONTROL_ATTR_ID)
    }

    #[inline]
    fn set_control_id(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(CONTROL_ATTR_ID, value);
    }

    #[inline]
    fn get_control_value(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(CONTROL_ATTR_VALUE)
    }

    #[inline]
    fn set_control_value(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(CONTROL_ATTR_VALUE, value);
    }
}
