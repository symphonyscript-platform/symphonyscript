use crate::constants::SEED_ATTR_VALUE;
use crate::symphony_engine::SymphonyEngine;

pub trait SeedOperations {
    fn get_seed_value(&self, node: usize) -> i32;
    fn set_seed_value(&self, node: usize, value: i32);
}

impl SeedOperations for SymphonyEngine {
    #[inline]
    fn get_seed_value(&self, node: usize) -> i32 {
        self.kernel.get_node(node).attr_read(SEED_ATTR_VALUE)
    }

    #[inline]
    fn set_seed_value(&self, node: usize, value: i32) {
        self.kernel
            .get_node(node)
            .attr_write(SEED_ATTR_VALUE, value);
    }
}
