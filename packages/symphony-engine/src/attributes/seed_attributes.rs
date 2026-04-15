use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct SeedAttributes {
    pub seed_value: i32,
}

impl IntoArray<NODE_ATTRIBUTES_SIZE> for SeedAttributes {
    fn to_array(&self) -> [i32; NODE_ATTRIBUTES_SIZE] {
        let mut data = [0; NODE_ATTRIBUTES_SIZE];

        data[0] = self.seed_value;

        data
    }
}
