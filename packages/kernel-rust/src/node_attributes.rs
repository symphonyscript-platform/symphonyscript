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

    pub fn pitch() -> i32 {

    }
}
