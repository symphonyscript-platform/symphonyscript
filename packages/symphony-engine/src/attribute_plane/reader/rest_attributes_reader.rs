use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct RestAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> RestAttributesReader<'a> {
    pub fn duration(&self) -> i32 {
        self.0.get(0)
    }
}
