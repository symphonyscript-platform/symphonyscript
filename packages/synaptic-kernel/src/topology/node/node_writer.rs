use crate::constants::NODE_SIZE;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::topology::slot_writer::SlotWriter;

pub struct NodeWriter<'a, const META_SIZE: usize> {
    core: SlotWriter<'a, NODE_SIZE>,
    meta: SlotWriter<'a, META_SIZE>,
}

impl<'a, const META_SIZE: usize> NodeWriter<'a, META_SIZE> {
    pub fn new(triple_buffer: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + NODE_SIZE + META_SIZE;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "NodeWriter::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            NODE_SIZE + META_SIZE,
            triple_buffer.buffer_capacity(),
        );

        NodeWriter {
            core: SlotWriter::new(&triple_buffer, tb_start_offset),
            meta: SlotWriter::new(&triple_buffer, tb_start_offset + NODE_SIZE),
        }
    }

    pub fn get_kind(&self) -> i32 {
        (self.core.read(0) as u32 >> 24) as i32
    }

    pub(crate) fn set_kind(&self, value: i32) {
        let bitmask = self.core.read(0) & ((1 << 24) - 1);
        self.core.write(0, bitmask | value << 24)
    }

    pub fn get_next_ptr(&self) -> usize {
        self.core.read(1) as usize
    }

    pub(crate) fn set_next_ptr(&self, value: usize) {
        self.core.write(1, value as i32)
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.core.read(2) as usize
    }

    pub(crate) fn set_prev_ptr(&self, value: usize) {
        self.core.write(2, value as i32)
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.core.read(3) as usize
    }

    pub(crate) fn set_outgoing_synapse_head(&self, value: usize) {
        self.core.write(3, value as i32)
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.core.read(4) as usize
    }

    pub(crate) fn set_outgoing_synapse_tail(&self, value: usize) {
        self.core.write(4, value as i32)
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.core.read(5) as usize
    }

    pub(crate) fn set_incoming_synapse_head(&self, value: usize) {
        self.core.write(5, value as i32)
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.core.read(6) as usize
    }

    pub(crate) fn set_incoming_synapse_tail(&self, value: usize) {
        self.core.write(6, value as i32)
    }

    pub fn get_meta(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }

    pub fn set_meta(&self, offset: usize, value: i32) {
        self.meta.write(offset, value)
    }
}
