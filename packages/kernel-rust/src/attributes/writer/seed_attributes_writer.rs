use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::primitives::into_array::IntoArray;
use crate::attributes::writer::attributes_writer::AttributesWriter;

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

pub struct SeedAttributesWriter<'a>(pub AttributesWriter<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SeedAttributesWriter<'a> {
    pub fn seed_value(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_seed_value(&self, value: i32) {
        self.0.write(0, value)
    }
}
