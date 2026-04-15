use synaptic_kernel::primitives::into_array::IntoArray;

pub struct RestAttributes {
    pub duration: i32,
}

impl IntoArray<16> for RestAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.duration;

        data
    }
}
