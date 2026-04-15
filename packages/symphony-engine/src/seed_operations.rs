use crate::constants::SEED_ATTR_VALUE;
use crate::symphony_engine::SymphonyEngine;

pub trait SeedOperations {
    fn get_seed_value(&self, node: usize) -> i32;
    fn set_seed_value(&self, node: usize, value: i32);
}

impl SeedOperations for SymphonyEngine {
    fn get_seed_value(&self, node: usize) -> i32 {
        self.kernel.get_node_attribute(node, SEED_ATTR_VALUE)
    }

    fn set_seed_value(&self, node: usize, value: i32) {
        self.kernel.set_node_attribute(node, SEED_ATTR_VALUE, value);
    }
}
