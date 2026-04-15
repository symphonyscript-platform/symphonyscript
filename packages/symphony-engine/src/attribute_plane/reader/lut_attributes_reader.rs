use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct LutAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> LutAttributesReader<'a> {
    pub fn lut_index(&self) -> i32 {
        self.0.get(0)
    }
}
