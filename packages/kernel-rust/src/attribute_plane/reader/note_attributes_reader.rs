use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;

pub struct NoteAttributesReader<'a>(pub AttributesReader<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> NoteAttributesReader<'a> {
    pub fn is_muted(&self) -> bool {
        self.flags() & (1 << 0) != 0
    }

    pub fn is_solo(&self) -> bool {
        self.flags() & (1 << 1) != 0
    }

    pub fn pitch(&self) -> i32 {
        self.0.read(0)
    }

    pub fn velocity(&self) -> i32 {
        self.0.read(1)
    }

    pub fn duration(&self) -> i32 {
        self.0.read(2)
    }

    pub fn volume(&self) -> i32 {
        self.0.read(3)
    }

    pub fn spatial_x(&self) -> i32 {
        self.0.read(4)
    }

    pub fn spatial_y(&self) -> i32 {
        self.0.read(5)
    }

    pub fn spatial_z(&self) -> i32 {
        self.0.read(6)
    }

    pub fn detune(&self) -> i32 {
        self.0.read(7)
    }

    pub fn tick_offset(&self) -> i32 {
        self.0.read(8)
    }

    pub fn flags(&self) -> u32 {
        self.0.read(9) as u32
    }
}
