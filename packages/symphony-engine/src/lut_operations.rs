use crate::constants::LUT_ATTR_INDEX;
use crate::symphony_engine::SymphonyEngine;

pub trait LutOperations {
    fn get_lut_index(&self, node: usize) -> i32;
    fn set_lut_index(&self, node: usize, value: i32);
}

impl LutOperations for SymphonyEngine {
    #[inline]
    fn get_lut_index(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(LUT_ATTR_INDEX)
    }

    #[inline]
    fn set_lut_index(&self, node: usize, value: i32) {
        self.kernel.get_node(node).attr_write(LUT_ATTR_INDEX, value);
    }
}
