pub const NODE_META_SIZE: usize = 8;
pub const NODE_ATTRIBUTES_SIZE: usize = 16;

pub const NODE_KIND_NOTE: i32 = 0x01;
pub const NODE_KIND_REST: i32 = 0x02;
pub const NODE_KIND_BARRIER: i32 = 0x03;
pub const NODE_KIND_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
pub const NODE_KIND_BOUNDARY: i32 = 0x05;
pub const NODE_KIND_SEED: i32 = 0x06;
pub const NODE_KIND_LUT: i32 = 0x07;

pub const NODE_META_BASE_TICK: usize = 0;
pub const NODE_META_MOD_HEAD: usize = 1;

pub const SYNAPSE_META_SIZE: usize = 8;
pub const SYNAPSE_ATTRIBUTES_SIZE: usize = 16;

pub const SYNAPSE_KIND_SEQUENTIAL: i32 = 0x01;
pub const SYNAPSE_KIND_PARALLEL: i32 = 0x02;

pub const SYNAPSE_ATTR_WEIGHT: usize = 0;
pub const SYNAPSE_ATTR_TICK_OFFSET: usize = 1;
pub const SYNAPSE_ATTR_TRANSPOSITION: usize = 2;
pub const SYNAPSE_ATTR_VOLUME_SCALE: usize = 3;
pub const SYNAPSE_ATTR_DURATION_SCALE: usize = 4;
pub const SYNAPSE_ATTR_TEMPO_SCALE: usize = 5;


pub const NOTE_ATTR_FLAGS: usize = 0;
pub const NOTE_ATTR_PITCH: usize = 1;
pub const NOTE_ATTR_VELOCITY: usize = 2;
pub const NOTE_ATTR_DURATION: usize = 3;
pub const NOTE_ATTR_VOLUME: usize = 4;
pub const NOTE_ATTR_SPATIAL_X: usize = 5;
pub const NOTE_ATTR_SPATIAL_Y: usize = 6;
pub const NOTE_ATTR_SPATIAL_Z: usize = 7;
pub const NOTE_ATTR_DETUNE: usize = 8;
pub const NOTE_ATTR_TICK_OFFSET: usize = 9;

pub const NOTE_FLAG_MUTED: u32 = 0;
pub const NOTE_FLAG_SOLO: u32 = 1;

