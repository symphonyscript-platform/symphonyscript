use crate::constants::REST_ATTR_DURATION;
use crate::symphony_engine::SymphonyEngine;

pub trait RestOperations {
    fn get_rest_duration(&self, node: usize) -> i32;
    fn set_rest_duration(&self, node: usize, value: i32);
}

impl RestOperations for SymphonyEngine {
    fn get_rest_duration(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, REST_ATTR_DURATION)
    }

    fn set_rest_duration(&self, node: usize, value: i32) {
        self.kernel
            .set_node_attribute(node, REST_ATTR_DURATION, value);
    }
}
