use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::structural_plane::slot_writer::SlotWriter;

pub struct SynapseWriter<'a>(pub SlotWriter<'a, SYNAPSE_SLOT_SIZE>);

impl<'a> SynapseWriter<'a> {
    pub fn get_opcode(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub(crate) fn set_opcode(&self, value: i32) {
        let bitmask = self.0.read(0) & ((1 << 24) - 1);
        self.0.write(0, bitmask | value << 24)
    }

    pub fn get_source_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub(crate) fn set_source_ptr(&self, value: usize) {
        self.0.write(1, value as i32)
    }

    pub fn get_target_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub(crate) fn set_target_ptr(&self, value: usize) {
        self.0.write(2, value as i32)
    }

    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.0.read(3) as usize
    }

    pub(crate) fn set_outgoing_next_ptr(&self, value: usize) {
        self.0.write(3, value as i32)
    }

    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.0.read(4) as usize
    }

    pub(crate) fn set_outgoing_prev_ptr(&self, value: usize) {
        self.0.write(4, value as i32)
    }

    pub fn get_incoming_next_ptr(&self) -> usize {
        self.0.read(5) as usize
    }

    pub(crate) fn set_incoming_next_ptr(&self, value: usize) {
        self.0.write(5, value as i32)
    }

    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.0.read(6) as usize
    }

    pub(crate) fn set_incoming_prev_ptr(&self, value: usize) {
        self.0.write(6, value as i32)
    }
}

#[cfg(test)]
mod tests {

}
