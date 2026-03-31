pub const NODE_SLOT_SIZE: usize = 16;
pub const NODE_ATTRIBUTES_SLOT_SIZE: usize = 16;

pub const NODE_OPCODE_NOTE: i32 = 0x01;
pub const NODE_OPCODE_REST: i32 = 0x02;
pub const NODE_OPCODE_BARRIER: i32 = 0x03;
pub const NODE_OPCODE_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
pub const NODE_OPCODE_BOUNDARY: i32 = 0x05;
pub const NODE_OPCODE_SEED: i32 = 0x06;
pub const NODE_OPCODE_LUT: i32 = 0x07;


pub const SYNAPSE_SLOT_SIZE: usize = 8;
pub const SYNAPSE_ATTRIBUTES_SLOT_SIZE: usize = 16;

pub const SYNAPSE_OPCODE_SEQUENTIAL: i32 = 0x01;
pub const SYNAPSE_OPCODE_PARALLEL: i32 = 0x02;
