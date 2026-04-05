use crate::constants::NODE_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::topology::slot_reader::SlotReader;

pub struct NodeReader<'a, const META_SIZE: usize> {
    core: SlotReader<'a, NODE_SIZE>,
    meta: SlotReader<'a, META_SIZE>,
}

impl<'a, const META_SIZE: usize> NodeReader<'a, META_SIZE> {
    pub fn new(triple_buffer: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + NODE_SIZE + META_SIZE;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "NodeReader::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            NODE_SIZE + META_SIZE,
            triple_buffer.buffer_capacity(),
        );

        NodeReader {
            core: SlotReader::new(&triple_buffer, tb_start_offset),
            meta: SlotReader::new(&triple_buffer, tb_start_offset + NODE_SIZE),
        }
    }

    pub fn get_kind(&self) -> i32 {
        (self.core.read(0) as u32 >> 24) as i32
    }

    pub fn get_next_ptr(&self) -> usize {
        self.core.read(1) as usize
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.core.read(2) as usize
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.core.read(3) as usize
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.core.read(4) as usize
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.core.read(5) as usize
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.core.read(6) as usize
    }

    pub fn get_meta(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }
}
