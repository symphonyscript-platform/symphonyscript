use crate::constants::SYNAPSE_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::topology::slot_reader::SlotReader;

pub struct SynapseReader<'a, const META_SIZE: usize> {
    core: SlotReader<'a, SYNAPSE_SIZE>,
    meta: SlotReader<'a, META_SIZE>,
}

impl<'a, const META_SIZE: usize> SynapseReader<'a, META_SIZE> {
    pub fn new(triple_buffer: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + SYNAPSE_SIZE + META_SIZE;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "SynapseReader::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            SYNAPSE_SIZE + META_SIZE,
            triple_buffer.buffer_capacity(),
        );

        SynapseReader {
            core: SlotReader::new(&triple_buffer, tb_start_offset),
            meta: SlotReader::new(&triple_buffer, tb_start_offset + SYNAPSE_SIZE),
        }
    }

    pub fn get_kind(&self) -> i32 {
        self.core.read(0) >> 24
    }

    pub fn get_source_ptr(&self) -> usize {
        self.core.read(1) as usize
    }

    pub fn get_target_ptr(&self) -> usize {
        self.core.read(2) as usize
    }

    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.core.read(3) as usize
    }

    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.core.read(4) as usize
    }

    pub fn get_incoming_next_ptr(&self) -> usize {
        self.core.read(5) as usize
    }

    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.core.read(6) as usize
    }
}
