use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct NodeAttributesData {
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
}

pub struct NodeAttributesView<'a> {
    pub(crate) sab: &'a SAB,
    pub(crate) start_index: usize,
}

impl<'a> NodeAttributesView<'a> {
    pub const SLOT_SIZE: usize = 10;

    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        let end_index = start_index + Self::SLOT_SIZE;
        debug_assert!(end_index < sab.len(), "NodeAttributesView out of bounds");
        NodeAttributesView {
            sab: &sab,
            start_index,
        }
    }

    pub fn resolve_sab_index(start_index: usize, offset: usize) -> usize {
        start_index + (offset * NodeAttributesView::SLOT_SIZE)
    }

    pub fn is_muted(&self) -> bool {
        let flags = self.flags();
        flags & (1 << 0) != 0
    }

    pub fn set_muted(&self) {
        self.set_flags(self.flags() | (1 << 0))
    }

    pub fn is_solo(&self) -> bool {
        let flags = self.flags();
        flags & (1 << 1) != 0
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

    fn read(&self, index: usize) -> i32 {
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    fn write(&self, index: usize, value: i32) {
        self.sab[self.start_index + index].store(value, Ordering::Relaxed)
    }
}
