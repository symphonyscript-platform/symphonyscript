use crate::constants::SYNAPSE_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::topology::synapse::synapse_reader::SynapseReader;
use crate::topology::topology_reader::TopologyReader;

#[derive(Clone)]
pub struct SynapseChainReader {
    topology: TopologyReader<SYNAPSE_SIZE>,
    start_offset: usize,
    end_offset: usize,
    capacity: usize,
}

impl SynapseChainReader {
    pub fn new(buffer: TripleBufferReader, start_offset: usize, capacity: usize) -> Self {
        let reader = TopologyReader::<SYNAPSE_SIZE>::new(buffer, start_offset, capacity);
        let end_offset = reader.tb_end_offset();

        SynapseChainReader {
            topology: reader,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn bind(buffer: TripleBufferReader, start_offset: usize, capacity: usize) -> Self {
        let reader = TopologyReader::<SYNAPSE_SIZE>::bind(buffer, start_offset, capacity);
        let end_offset = reader.tb_end_offset();

        SynapseChainReader {
            topology: reader,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn tb_start_offset(&self) -> usize {
        self.start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> SynapseReader<'_> {
        SynapseReader(self.topology.get(slot))
    }
}
