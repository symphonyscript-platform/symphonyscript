use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_writer::AttributesWriter;
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

pub struct ControlAttributesWriter<'a>(pub AttributesWriter<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> ControlAttributesWriter<'a> {
    pub fn control_id(&self) -> i32 {
        self.0.get(0)
    }

    pub fn set_control_id(&self, value: i32) {
        self.0.set(0, value)
    }

    pub fn value(&self) -> i32 {
        self.0.get(1)
    }

    pub fn set_value(&self, value: i32) {
        self.0.set(1, value)
    }
}
