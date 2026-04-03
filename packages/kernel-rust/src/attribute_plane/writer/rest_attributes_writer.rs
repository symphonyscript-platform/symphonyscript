use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::primitives::into_array::IntoArray;
use crate::attribute_plane::writer::attributes_writer::AttributesWriter;

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

pub struct RestAttributesWriter<'a>(pub AttributesWriter<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> RestAttributesWriter<'a> {
    pub fn duration(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_duration(&self, value: i32) {
        self.0.write(0, value)
    }
}
