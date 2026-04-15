use crate::constants::NODE_ATTRIBUTES_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;

pub struct NoteAttributes {
    pub pitch: i32,
    pub velocity: i32,
    pub duration: i32,
    pub volume: i32,
    pub spatial_x: i32, // left-right (stereo-pan)
    pub spatial_y: i32, // front-back (depth)
    pub spatial_z: i32, // up-down (elevation)
    pub detune: i32,
    pub tick_offset: i32,
    pub flags: u32, // bit 0: muted | bit 1: solo | bits 2-31: reserved
                    // +24 bytes reserved
}

impl IntoArray<NODE_ATTRIBUTES_SIZE> for NoteAttributes {
    fn to_array(&self) -> [i32; NODE_ATTRIBUTES_SIZE] {
        let mut data = [0; NODE_ATTRIBUTES_SIZE];

        data[0] = self.pitch;
        data[1] = self.velocity;
        data[2] = self.duration;
        data[3] = self.volume;
        data[4] = self.spatial_x;
        data[5] = self.spatial_y;
        data[6] = self.spatial_z;
        data[7] = self.detune;
        data[8] = self.tick_offset;
        data[9] = self.flags as i32;

        data
    }
}
