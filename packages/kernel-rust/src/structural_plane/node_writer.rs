use crate::primitives::into_array::IntoArray;
use crate::structural_plane::slot_writer::SlotWriter;

pub struct NodeDraft {
    pub opcode: i32,
    pub base_tick: i32,
}

pub struct NodeData {
    pub opcode: i32,
    pub base_tick: i32,
    pub next_ptr: i32,
    pub prev_ptr: i32,
    pub synapse_list_head: i32,
    pub reverse_synapse_head: i32,
    pub mod_list_head: i32,
    // +4 bytes reserved
}

impl IntoArray<8> for NodeData {
    fn to_array(&self) -> [i32; NodeWriter::SLOT_SIZE] {
        let mut data = [0; NodeWriter::SLOT_SIZE];

        data[0] = self.opcode;
        data[1] = self.base_tick;
        data[2] = self.next_ptr;
        data[3] = self.prev_ptr;
        data[4] = self.synapse_list_head;
        data[5] = self.reverse_synapse_head;
        data[6] = self.mod_list_head;

        data
    }
}

pub struct NodeWriter<'a>(pub SlotWriter<'a, { NodeWriter::SLOT_SIZE }>);

impl<'a> NodeWriter<'a> {
    pub const SLOT_SIZE: usize = 8;
    pub const OPCODE_NOTE: i32 = 0x01;
    pub const OPCODE_REST: i32 = 0x02;
    pub const OPCODE_BARRIER: i32 = 0x03;
    pub const OPCODE_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
    pub const OPCODE_BOUNDARY: i32 = 0x05;
    pub const OPCODE_SEED: i32 = 0x06;
    pub const OPCODE_LUT: i32 = 0x07;

    pub fn get_opcode(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn set_opcode(&self, value: i32) {
        let bitmask = self.0.read(0) & ((1 << 24) - 1);
        self.0.write(0, bitmask | value << 24)
    }

    pub fn get_base_tick(&self) -> i32 {
        self.0.read(1)
    }

    pub fn set_base_tick(&self, value: i32) {
        self.0.write(1, value)
    }

    pub fn get_next_ptr(&self) -> i32 {
        self.0.read(2)
    }

    pub fn set_next_ptr(&self, value: i32) {
        self.0.write(2, value)
    }

    pub fn get_prev_ptr(&self) -> i32 {
        self.0.read(3)
    }

    pub fn set_prev_ptr(&self, value: i32) {
        self.0.write(3, value)
    }

    pub fn get_synapse_list_head(&self) -> i32 {
        self.0.read(4)
    }

    pub fn set_synapse_list_head(&self, value: i32) {
        self.0.write(4, value)
    }

    pub fn get_reverse_synapse_head(&self) -> i32 {
        self.0.read(5)
    }

    pub fn set_reverse_synapse_head(&self, value: i32) {
        self.0.write(5, value)
    }

    pub fn get_mod_list_head(&self) -> i32 {
        self.0.read(6)
    }

    pub fn set_mod_list_head(&self, value: i32) {
        self.0.write(6, value)
    }
}
