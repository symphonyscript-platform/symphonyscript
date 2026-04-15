use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct BoundaryAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SIZE>);

impl<'a> BoundaryAttributesReader<'a> {
    pub fn boundary_id(&self) -> i32 {
        self.0.get(0)
    }
}
