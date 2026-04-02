use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::structural_plane::structural_reader::StructuralReader;
use crate::structural_plane::synapse::synapse_reader::SynapseReader;

pub struct SynapseChainReader {
    reader: StructuralReader<SYNAPSE_SLOT_SIZE>,
}

impl SynapseChainReader {
    pub fn new(reader: StructuralReader<SYNAPSE_SLOT_SIZE>) -> Self {
        SynapseChainReader { reader }
    }

    pub fn bind(reader: StructuralReader<SYNAPSE_SLOT_SIZE>) -> Self {
        Self::new(reader)
    }

    pub fn get(&'_ self, slot: usize) -> SynapseReader<'_> {
        SynapseReader(self.reader.get(slot))
    }
}
