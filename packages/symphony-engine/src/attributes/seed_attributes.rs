use synaptic_kernel::primitives::into_array::IntoArray;

pub struct SeedAttributes {
    pub seed_value: i32,
}

impl IntoArray<16> for SeedAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.seed_value;

        data
    }
}
