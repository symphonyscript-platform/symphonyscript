use symphony_engine::attribute_plane::::attributes_reader::AttributesReader;
use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct SeedAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SeedAttributesReader<'a> {
    pub fn seed_value(&self) -> i32 {
        self.0.read(0)
    }
}
