use crate::constants::NODE_SLOT_SIZE;
use crate::primitives::into_array::IntoArray;
use crate::structural_plane::slot_writer::SlotWriter;

pub struct NodeDraft {
    pub opcode: i32,
    pub base_tick: i32,
}

pub struct NodeData {
    pub opcode: i32,
    pub base_tick: i32,
    pub next_ptr: usize,
    pub prev_ptr: usize,
    pub synapse_list_head: usize,
    pub reverse_synapse_head: usize,
    pub mod_list_head: usize,
    // +4 bytes reserved
}

impl IntoArray<8> for NodeData {
    fn to_array(&self) -> [i32; NODE_SLOT_SIZE] {
        let mut data = [0; NODE_SLOT_SIZE];

        data[0] = self.opcode;
        data[1] = self.base_tick;
        data[2] = self.next_ptr as i32;
        data[3] = self.prev_ptr as i32;
        data[4] = self.synapse_list_head as i32;
        data[5] = self.reverse_synapse_head as i32;
        data[6] = self.mod_list_head as i32;

        data
    }
}

pub struct NodeWriter<'a>(pub SlotWriter<'a, NODE_SLOT_SIZE>);

impl<'a> NodeWriter<'a> {
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

    pub fn get_next_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub fn set_next_ptr(&self, value: usize) {
        self.0.write(2, value as i32)
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.0.read(3) as usize
    }

    pub fn set_prev_ptr(&self, value: usize) {
        self.0.write(3, value as i32)
    }

    pub fn get_synapse_list_head(&self) -> usize {
        self.0.read(4) as usize
    }

    pub fn set_synapse_list_head(&self, value: usize) {
        self.0.write(4, value as i32)
    }

    pub fn get_reverse_synapse_head(&self) -> usize {
        self.0.read(5) as usize
    }

    pub fn set_reverse_synapse_head(&self, value: usize) {
        self.0.write(5, value as i32)
    }

    pub fn get_mod_list_head(&self) -> usize {
        self.0.read(6) as usize
    }

    pub fn set_mod_list_head(&self, value: usize) {
        self.0.write(6, value as i32)
    }
}
