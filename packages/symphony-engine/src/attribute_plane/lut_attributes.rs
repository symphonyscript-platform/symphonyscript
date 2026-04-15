use synaptic_kernel::primitives::into_array::IntoArray;

pub struct LutAttributes {
    pub lut_index: i32,
}

impl IntoArray<16> for LutAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.lut_index;

        data
    }
}
