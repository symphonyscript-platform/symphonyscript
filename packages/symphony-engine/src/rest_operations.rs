use crate::constants::REST_ATTR_DURATION;
use crate::symphony_engine::SymphonyEngine;

pub trait RestOperations {
    fn get_rest_duration(&self, node: usize) -> i32;
    fn set_rest_duration(&self, node: usize, value: i32);
}

impl RestOperations for SymphonyEngine {
    #[inline]
    fn get_rest_duration(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(REST_ATTR_DURATION)
    }

    #[inline]
    fn set_rest_duration(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(REST_ATTR_DURATION, value);
    }
}
