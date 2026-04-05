use symphony_engine::attribute_plane::::attributes_reader::AttributesReader;
use symphonyscript_kernel::constants::SYNAPSE_ATTRIBUTES_SLOT_SIZE;

pub struct SynapseAttributesReader<'a>(pub AttributesReader<'a, SYNAPSE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SynapseAttributesReader<'a> {
    pub fn weight(&self) -> i32 {
        self.0.read(0)
    }

    pub fn tick_offset(&self) -> i32 {
        self.0.read(1)
    }

    pub fn transpose(&self) -> i32 {
        self.0.read(2)
    }

    pub fn volume_scale(&self) -> i32 {
        self.0.read(3)
    }

    pub fn duration_scale(&self) -> i32 {
        self.0.read(4)
    }

    pub fn tempo_scale(&self) -> i32 {
        self.0.read(5)
    }
}
