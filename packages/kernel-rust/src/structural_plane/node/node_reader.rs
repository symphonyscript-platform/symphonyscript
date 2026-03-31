use crate::constants::NODE_SLOT_SIZE;
use crate::structural_plane::slot_reader::SlotReader;

pub struct NodeReader<'a>(pub SlotReader<'a, NODE_SLOT_SIZE>);

impl<'a> NodeReader<'a> {
    pub fn get_opcode(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_base_tick(&self) -> i32 {
        self.0.read(1)
    }

    pub fn get_next_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.0.read(3) as usize
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.0.read(4) as usize
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.0.read(5) as usize
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.0.read(6) as usize
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.0.read(7) as usize
    }

    pub fn get_mod_head(&self) -> usize {
        self.0.read(8) as usize
    }
}
