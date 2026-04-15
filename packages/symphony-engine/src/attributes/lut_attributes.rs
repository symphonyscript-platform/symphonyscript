use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct LutAttributes {
    pub lut_index: i32,
}

impl IntoArray<NODE_ATTRIBUTES_SIZE> for LutAttributes {
    fn to_array(&self) -> [i32; NODE_ATTRIBUTES_SIZE] {
        let mut data = [0; NODE_ATTRIBUTES_SIZE];

        data[0] = self.lut_index;

        data
    }
}
