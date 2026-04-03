use crate::attribute_plane::writer::attributes_writer::AttributesWriter;
use crate::constants::SYNAPSE_ATTRIBUTES_SLOT_SIZE;
use crate::primitives::into_array::IntoArray;

pub struct SynapseAttributes {
    pub weight: i32,
    pub tick_offset: i32,
    pub transpose: i32,
    pub volume_scale: i32,
    pub duration_scale: i32,
    pub tempo_scale: i32,
}

impl IntoArray<SYNAPSE_ATTRIBUTES_SLOT_SIZE> for SynapseAttributes {
    fn to_array(&self) -> [i32; SYNAPSE_ATTRIBUTES_SLOT_SIZE] {
        let mut data = [0; SYNAPSE_ATTRIBUTES_SLOT_SIZE];

        data[0] = self.weight;
        data[1] = self.tick_offset;
        data[2] = self.transpose;
        data[3] = self.volume_scale;
        data[4] = self.duration_scale;
        data[5] = self.tempo_scale;

        data
    }
}

pub struct SynapseAttributesWriter<'a>(pub AttributesWriter<'a, SYNAPSE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SynapseAttributesWriter<'a> {
    pub fn weight(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_weight(&self, value: i32) {
        self.0.write(0, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.0.read(1)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.0.write(1, value)
    }

    pub fn transpose(&self) -> i32 {
        self.0.read(2)
    }

    pub fn set_transpose(&self, value: i32) {
        self.0.write(2, value)
    }

    pub fn volume_scale(&self) -> i32 {
        self.0.read(3)
    }

    pub fn set_volume_scale(&self, value: i32) {
        self.0.write(3, value)
    }

    pub fn duration_scale(&self) -> i32 {
        self.0.read(4)
    }

    pub fn set_duration_scale(&self, value: i32) {
        self.0.write(4, value)
    }

    pub fn tempo_scale(&self) -> i32 {
        self.0.read(5)
    }

    pub fn set_tempo_scale(&self, value: i32) {
        self.0.write(5, value)
    }
}
