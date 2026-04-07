use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::topology::synapse::synapse_chain_writer::SynapseChainWriter;
use crate::topology::synapse::synapse_reader::SynapseReader;

#[derive(Clone)]
pub struct SynapseChainReader<const NODE_META_SIZE: usize, const SYNAPSE_META_SIZE: usize> {
    triple_buffer: TripleBufferReader,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const NODE_META_SIZE: usize, const SYNAPSE_META_SIZE: usize>
    SynapseChainReader<NODE_META_SIZE, SYNAPSE_META_SIZE>
{
    pub(crate) fn bind(
        triple_buffer: TripleBufferReader,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let tb_end_offset = tb_start_offset
            + SynapseChainWriter::<NODE_META_SIZE, SYNAPSE_META_SIZE>::calculate_size_on_tb(
                capacity,
            );

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "SynapseChainReader::bind | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        SynapseChainReader {
            triple_buffer,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> SynapseReader<'_, SYNAPSE_META_SIZE> {
        let start_offset =
            SynapseChainWriter::<NODE_META_SIZE, SYNAPSE_META_SIZE>::calculate_synapse_start_offset(
                self.tb_start_offset,
                slot,
            );
        SynapseReader::new(&self.triple_buffer, start_offset)
    }
}
