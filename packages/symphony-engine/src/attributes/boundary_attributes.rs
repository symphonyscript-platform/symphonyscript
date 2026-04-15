use synaptic_kernel::primitives::into_array::IntoArray;

pub struct BoundaryAttributes {
    pub boundary_id: i32,
}

impl IntoArray<16> for BoundaryAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.boundary_id;

        data
    }
}
