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
    threshold: i32, // density-gate
    probability: i32, // based on deterministic PRNG-seed. Kernel stays pure.
}

impl NodeAttributesData {

}
