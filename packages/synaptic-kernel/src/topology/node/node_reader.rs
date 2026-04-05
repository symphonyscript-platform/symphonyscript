use crate::constants::NODE_SIZE;
use crate::topology::slot_reader::SlotReader;

pub struct NodeReader<'a>(pub SlotReader<'a, NODE_SIZE>);

impl<'a> NodeReader<'a> {
    pub fn get_kind(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_next_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.0.read(3) as usize
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.0.read(4) as usize
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.0.read(5) as usize
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.0.read(6) as usize
    }
}
