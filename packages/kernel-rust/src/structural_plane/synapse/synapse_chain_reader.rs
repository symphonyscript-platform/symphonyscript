use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::structural_reader::StructuralReader;
use crate::structural_plane::synapse::synapse_reader::SynapseReader;

#[derive(Clone)]
pub struct SynapseChainReader {
    reader: StructuralReader<SYNAPSE_SLOT_SIZE>,
    start_offset: usize,
    end_offset: usize,
    capacity: usize,
}

impl SynapseChainReader {
    pub fn new(buffer: TripleBufferReader, start_offset: usize, capacity: usize) -> Self {
        let reader = StructuralReader::<SYNAPSE_SLOT_SIZE>::new(buffer, start_offset, capacity);
        let end_offset = reader.triple_buffer_end_offset();

        SynapseChainReader {
            reader,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn bind(buffer: TripleBufferReader, start_offset: usize, capacity: usize) -> Self {
        let reader = StructuralReader::<SYNAPSE_SLOT_SIZE>::bind(buffer, start_offset, capacity);
        let end_offset = reader.triple_buffer_end_offset();

        SynapseChainReader {
            reader,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn triple_buffer_start_offset(&self) -> usize {
        self.start_offset
    }

    pub fn triple_buffer_end_offset(&self) -> usize {
        self.end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> SynapseReader<'_> {
        SynapseReader(self.reader.get(slot))
    }
}
