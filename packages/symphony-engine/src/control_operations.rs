use crate::constants::{CONTROL_ATTR_ID, CONTROL_ATTR_VALUE};
use crate::symphony_engine::SymphonyEngine;

pub trait ControlOperations {
    fn get_control_id(&self, node: usize) -> i32;
    fn set_control_id(&self, node: usize, value: i32);

    fn get_control_value(&self, node: usize) -> i32;
    fn set_control_value(&self, node: usize, value: i32);
}

impl ControlOperations for SymphonyEngine {
    fn get_control_id(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, CONTROL_ATTR_ID)
    }

    fn set_control_id(&self, node: usize, value: i32) {
        self.kernel.set_node_attribute(node, CONTROL_ATTR_ID, value);
    }

    fn get_control_value(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, CONTROL_ATTR_VALUE)
    }

    fn set_control_value(&self, node: usize, value: i32) {
        self.kernel
            .set_node_attribute(node, CONTROL_ATTR_VALUE, value);
    }
}
