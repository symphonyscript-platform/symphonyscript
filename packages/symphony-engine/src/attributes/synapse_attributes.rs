use crate::constants::SYNAPSE_ATTRIBUTES_STRIDE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct SynapseAttributes {
    pub weight: i32,
    pub tick_offset: i32,
    pub transpose: i32,
    pub volume_scale: i32,
    pub duration_scale: i32,
    pub tempo_scale: i32,
}

impl IntoArray<SYNAPSE_ATTRIBUTES_STRIDE> for SynapseAttributes {
    fn to_array(&self) -> [i32; SYNAPSE_ATTRIBUTES_STRIDE] {
        let mut data = [0; SYNAPSE_ATTRIBUTES_STRIDE];

        data[0] = self.weight;
        data[1] = self.tick_offset;
        data[2] = self.transpose;
        data[3] = self.volume_scale;
        data[4] = self.duration_scale;
        data[5] = self.tempo_scale;

        data
    }
}
