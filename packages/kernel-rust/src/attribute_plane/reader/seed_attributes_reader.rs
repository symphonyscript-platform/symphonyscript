use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct SeedAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SeedAttributesReader<'a> {
    pub fn seed_value(&self) -> i32 {
        self.0.read(0)
    }
}
