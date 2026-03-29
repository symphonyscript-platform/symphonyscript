use std::sync::atomic::Ordering;
use crate::primitives::types::SAB;

pub struct NodeAttributesData {
    pitch: i32,
    velocity: i32,
    duration: i32,
    volume: i32,
    spatial_x: i32, // left-right (stereo-pan)
    spatial_y: i32, // front-back (depth)
    spatial_z: i32, // up-down (elevation)
    detune: i32,
    tick_offset: i32,
    flags: i32, // bit 0: muted | bit 1: solo | bits 2-31: reserved
}

pub struct NodeAttributesView<'a> {
    sab: &'a SAB,
    start_index: usize,
}

impl<'a> NodeAttributesView<'a> {
    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        NodeAttributesView {
            sab: &sab,
            start_index,
        }
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

    pub fn spatial_x(&self) -> i32 {
        self.read(3)
    }

    pub fn set_spatial_x(&self, value: i32) {
        self.write(3, value)
    }

    pub fn spatial_y(&self) -> i32 {
        self.read(4)
    }

    pub fn set_spatial_y(&self, value: i32) {
        self.write(4, value)
    }

    pub fn spatial_z(&self) -> i32 {
        self.read(5)
    }

    pub fn set_spatial_z(&self, value: i32) {
        self.write(5, value)
    }

    pub fn detune(&self) -> i32 {
        self.read(6)
    }

    pub fn set_detune(&self, value: i32) {
        self.write(5, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.read(7)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.write(7, value)
    }

    pub fn flags(&self) -> i32 {
        self.read(8)
    }

    pub fn set_flags(&self, value: i32) {
        self.write(8, value)
    }

    fn read(&self, index: usize) -> i32 {
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    fn write(&self, index: usize, value: i32) {
        self.sab[self.start_index + index].store(value, Ordering::Relaxed)
    }
}
