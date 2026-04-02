use crate::attributes::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct BarrierAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> BarrierAttributesReader<'a> {
    pub fn phase_target(&self) -> i32 {
        self.0.read(0)
    }
}
