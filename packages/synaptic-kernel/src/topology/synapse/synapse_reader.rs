use crate::constants::SYNAPSE_SIZE;
use crate::topology::slot_reader::SlotReader;

pub struct SynapseReader<'a>(pub SlotReader<'a, SYNAPSE_SIZE>);

impl<'a> SynapseReader<'a> {
    pub fn get_kind(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_source_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub fn get_target_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.0.read(3) as usize
    }

    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.0.read(4) as usize
    }

    pub fn get_incoming_next_ptr(&self) -> usize {
        self.0.read(5) as usize
    }

    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.0.read(6) as usize
    }
}
