use crate::constants::SYNAPSE_ATTRIBUTES_SIZE;
use synaptic_kernel::attribute_plane::attributes_reader::AttributesReader;

pub struct SynapseAttributesReader<'a>(pub AttributesReader<'a, SYNAPSE_ATTRIBUTES_SIZE>);

impl<'a> SynapseAttributesReader<'a> {
    pub fn weight(&self) -> i32 {
        self.0.get(0)
    }

    pub fn tick_offset(&self) -> i32 {
        self.0.get(1)
    }

    pub fn transpose(&self) -> i32 {
        self.0.get(2)
    }

    pub fn volume_scale(&self) -> i32 {
        self.0.get(3)
    }

    pub fn duration_scale(&self) -> i32 {
        self.0.get(4)
    }

    pub fn tempo_scale(&self) -> i32 {
        self.0.get(5)
    }
}
