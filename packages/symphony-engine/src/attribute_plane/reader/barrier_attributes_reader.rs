use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct BarrierAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> BarrierAttributesReader<'a> {
    pub fn phase_target(&self) -> i32 {
        self.0.get(0)
    }
}
