use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct LutAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> LutAttributesReader<'a> {
    pub fn lut_index(&self) -> i32 {
        self.0.read(0)
    }
}
