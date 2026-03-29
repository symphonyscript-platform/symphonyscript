use std::sync::atomic::Ordering;
use crate::primitives::types::SAB;

pub struct NodeAttributesData {
    pitch: i32,
    velocity: i32,
    duration: i32,
    volume: i32,
    pan: i32,
    spatial_x: i32, // left-right (stereo-pan)
    spatial_y: i32, // front-back (depth)
    spatial_z: i32, // up-down (elevation)
    detune: i32,
    tick_offset: i32,
}

pub struct NodeAttributesView {
    sab: SAB,
    start_index: usize,
}

impl NodeAttributesView {
    pub fn new(sab: SAB, start_index: usize) -> Self {
        NodeAttributesView {
            sab,
            start_index,
        }
    }

    pub fn pitch(&self) -> i32 {
        self.read(1)
    }

    pub fn pitch(&self) -> i32 {
        self.read(1)
    }

    fn read(&self, index: usize) -> i32 {
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    fn write(&self, index: usize, value: i32) {
        self.sab[self.start_index + index].store(value, Ordering::Relaxed)
    }
}
