use symphony_engine::attribute_plane::::attributes_reader::AttributesReader;
use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct ControlAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> ControlAttributesReader<'a> {
    pub fn control_id(&self) -> i32 {
        self.0.read(0)
    }

    pub fn value(&self) -> i32 {
        self.0.read(1)
    }
}
