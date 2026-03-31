use crate::constants::NODE_SLOT_SIZE;
use crate::structural_plane::slot_writer::SlotWriter;

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

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.0.read(4) as usize
    }

    pub fn set_outgoing_synapse_head(&self, value: usize) {
        self.0.write(4, value as i32)
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.0.read(5) as usize
    }

    pub fn set_outgoing_synapse_tail(&self, value: usize) {
        self.0.write(5, value as i32)
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.0.read(6) as usize
    }

    pub fn set_incoming_synapse_head(&self, value: usize) {
        self.0.write(6, value as i32)
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.0.read(7) as usize
    }

    pub fn set_incoming_synapse_tail(&self, value: usize) {
        self.0.write(7, value as i32)
    }

    pub fn get_mod_head(&self) -> usize {
        self.0.read(8) as usize
    }

    pub fn set_mod_head(&self, value: usize) {
        self.0.write(8, value as i32)
    }
}
