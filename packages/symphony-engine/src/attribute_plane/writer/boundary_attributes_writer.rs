use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphony_engine::attribute_plane::::attributes_writer::AttributesWriter;

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

pub struct BoundaryAttributesWriter<'a>(pub AttributesWriter<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> BoundaryAttributesWriter<'a> {
    pub fn boundary_id(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_boundary_id(&self, value: i32) {
        self.0.write(0, value)
    }
}
