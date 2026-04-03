use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct BoundaryAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> BoundaryAttributesReader<'a> {
    pub fn boundary_id(&self) -> i32 {
        self.0.read(0)
    }
}
