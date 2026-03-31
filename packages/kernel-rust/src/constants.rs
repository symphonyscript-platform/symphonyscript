pub const NODE_SLOT_SIZE: usize = 8;
pub const NODE_ATTRIBUTES_SLOT_SIZE: usize = 16;
pub const SYNAPSE_ATTRIBUTES_SLOT_SIZE: usize = 16;

pub const OPCODE_NOTE: i32 = 0x01;
pub const OPCODE_REST: i32 = 0x02;
pub const OPCODE_BARRIER: i32 = 0x03;
pub const OPCODE_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
pub const OPCODE_BOUNDARY: i32 = 0x05;
pub const OPCODE_SEED: i32 = 0x06;
pub const OPCODE_LUT: i32 = 0x07;
