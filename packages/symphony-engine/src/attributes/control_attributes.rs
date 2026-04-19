use crate::constants::NODE_ATTRIBUTES_STRIDE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct ControlAttributes {
    pub control_id: i32,
    pub value: i32,
}

impl IntoArray<NODE_ATTRIBUTES_STRIDE> for ControlAttributes {
    fn to_array(&self) -> [i32; NODE_ATTRIBUTES_STRIDE] {
        let mut data = [0; NODE_ATTRIBUTES_STRIDE];

        data[0] = self.control_id;
        data[1] = self.value;

        data
    }
}
