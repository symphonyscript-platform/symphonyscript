use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct ControlAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> ControlAttributesReader<'a> {
    pub fn control_id(&self) -> i32 {
        self.0.get(0)
    }

    pub fn value(&self) -> i32 {
        self.0.get(1)
    }
}
