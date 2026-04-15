use crate::constants::LUT_ATTR_INDEX;
use crate::symphony_engine::SymphonyEngine;

pub trait LutOperations {
    fn get_lut_index(&self, node: usize) -> i32;
    fn set_lut_index(&self, node: usize, value: i32);
}

impl LutOperations for SymphonyEngine {
    fn get_lut_index(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, LUT_ATTR_INDEX)
    }

    fn set_lut_index(&self, node: usize, value: i32) {
        self.kernel.set_node_attribute(node, LUT_ATTR_INDEX, value);
    }
}
