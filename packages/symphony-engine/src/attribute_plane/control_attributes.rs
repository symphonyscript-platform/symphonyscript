use synaptic_kernel::primitives::into_array::IntoArray;

pub struct ControlAttributes {
    pub control_id: i32,
    pub value: i32,
}

impl IntoArray<16> for ControlAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.control_id;
        data[1] = self.value;

        data
    }
}
