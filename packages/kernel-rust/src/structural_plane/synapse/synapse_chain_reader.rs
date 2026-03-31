use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::structural_plane::structural_reader::StructuralReader;
use crate::structural_plane::synapse::synapse_reader::SynapseReader;

pub struct SynapseChainReader<'a> {
    reader: &'a StructuralReader<'a, SYNAPSE_SLOT_SIZE>,
}

impl<'a> SynapseChainReader<'a> {
    pub fn new(reader: &'a StructuralReader<'a, SYNAPSE_SLOT_SIZE>) -> Self {
        SynapseChainReader { reader }
    }

    pub fn get(&'_ self, slot: usize) -> SynapseReader<'_> {
        SynapseReader(self.reader.get(slot))
    }
}
