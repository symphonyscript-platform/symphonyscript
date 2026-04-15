use synaptic_kernel::primitives::into_array::IntoArray;

pub struct BarrierAttributes {
    pub phase_target: i32,
}

impl IntoArray<16> for BarrierAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.phase_target;

        data
    }
}
