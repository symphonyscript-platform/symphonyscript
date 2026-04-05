use crate::constants::NODE_SIZE;
use crate::topology::slot_writer::SlotWriter;

pub struct NodeWriter<'a>(pub SlotWriter<'a, NODE_SIZE>);

impl<'a> NodeWriter<'a> {
    pub fn get_kind(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_next_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub(crate) fn set_next_ptr(&self, value: usize) {
        self.0.write(1, value as i32)
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub(crate) fn set_prev_ptr(&self, value: usize) {
        self.0.write(2, value as i32)
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.0.read(3) as usize
    }

    pub(crate) fn set_outgoing_synapse_head(&self, value: usize) {
        self.0.write(3, value as i32)
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.0.read(4) as usize
    }

    pub(crate) fn set_outgoing_synapse_tail(&self, value: usize) {
        self.0.write(4, value as i32)
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.0.read(5) as usize
    }

    pub(crate) fn set_incoming_synapse_head(&self, value: usize) {
        self.0.write(5, value as i32)
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.0.read(6) as usize
    }

    pub(crate) fn set_incoming_synapse_tail(&self, value: usize) {
        self.0.write(6, value as i32)
    }
}
