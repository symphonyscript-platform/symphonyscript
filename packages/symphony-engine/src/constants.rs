pub const CONTROLLER_MAGIC: u32 = 0x53594752;
pub const GRAPH_MAGIC: i32 = 0x53594354;
pub const KERNEL_VERSION: i32 = 0x01;

pub const NODE_META_SIZE: usize = 8;
pub const NODE_ATTRIBUTES_SIZE: usize = 8;

pub const NODE_KIND_NOTE: i32 = 0x01;
pub const NODE_KIND_REST: i32 = 0x02;
pub const NODE_KIND_BARRIER: i32 = 0x03;
pub const NODE_KIND_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
pub const NODE_KIND_BOUNDARY: i32 = 0x05;
pub const NODE_KIND_SEED: i32 = 0x06;
pub const NODE_KIND_LUT: i32 = 0x07;

pub const SYNAPSE_META_SIZE: usize = 8;
pub const SYNAPSE_ATTRIBUTES_SIZE: usize = 16;

pub const SYNAPSE_KIND_SEQUENTIAL: i32 = 0x01;
pub const SYNAPSE_KIND_PARALLEL: i32 = 0x02;
