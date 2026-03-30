use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::NodeAttributesView;

pub struct NoteAttributesData {
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

impl IntoNodeAttributesArray<16> for NoteAttributesData {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

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

pub struct NoteAttributesView<'a>(NodeAttributesView<'a>);

impl<'a> NoteAttributesView<'a> {
    pub fn is_muted(&self) -> bool {
        self.flags() & (1 << 0) != 0
    }

    pub fn set_muted(&self) {
        self.set_flags(self.flags() | (1 << 0))
    }

    pub fn is_solo(&self) -> bool {
        self.flags() & (1 << 1) != 0
    }

    pub fn set_solo(&self) {
        self.set_flags(self.flags() | (1 << 1))
    }

    pub fn pitch(&self) -> i32 {
        self.read(0)
    }

    pub fn set_pitch(&self, value: i32) {
        self.write(0, value)
    }

    pub fn velocity(&self) -> i32 {
        self.read(1)
    }

    pub fn set_velocity(&self, value: i32) {
        self.write(1, value)
    }

    pub fn duration(&self) -> i32 {
        self.read(2)
    }

    pub fn set_duration(&self, value: i32) {
        self.write(2, value)
    }

    pub fn volume(&self) -> i32 {
        self.read(3)
    }

    pub fn set_volume(&self, value: i32) {
        self.write(3, value)
    }

    pub fn spatial_x(&self) -> i32 {
        self.read(4)
    }

    pub fn set_spatial_x(&self, value: i32) {
        self.write(4, value)
    }

    pub fn spatial_y(&self) -> i32 {
        self.read(5)
    }

    pub fn set_spatial_y(&self, value: i32) {
        self.write(5, value)
    }

    pub fn spatial_z(&self) -> i32 {
        self.read(6)
    }

    pub fn set_spatial_z(&self, value: i32) {
        self.write(6, value)
    }

    pub fn detune(&self) -> i32 {
        self.read(7)
    }

    pub fn set_detune(&self, value: i32) {
        self.write(7, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.read(8)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.write(8, value)
    }

    pub fn flags(&self) -> u32 {
        self.read(9) as u32
    }

    pub fn set_flags(&self, value: u32) {
        self.write(9, value as i32)
    }

    fn read(&self, offset: usize) -> i32 {
        self.0.read(offset)
    }

    fn write(&self, offset: usize, value: i32) {
        self.0.write(offset, value)
    }
}
