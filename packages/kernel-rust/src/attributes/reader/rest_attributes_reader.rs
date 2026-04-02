use crate::attributes::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct RestAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> RestAttributesReader<'a> {
    pub fn duration(&self) -> i32 {
        self.0.read(0)
    }
}
