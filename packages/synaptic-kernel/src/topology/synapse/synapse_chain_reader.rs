use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::topology::synapse::synapse_reader::SynapseReader;

/// Consumer-side triple-buffered multi-linked list for graph synapses.
///
/// Provides read-only structural traversal of the synapse topology.
///
/// # Threading
/// Consumer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// Shares backing region with `SynapseChainWriter`. See its layout.
///
/// # Constraints
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Created exclusively via `SynapseChainWriter::to_reader()`.
#[derive(Clone)]
pub struct SynapseChainReader<
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    ds: EntryStoreReader<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
}

impl<const META_STRIDE: usize, const ATTR_STRIDE: usize>
    SynapseChainReader<META_STRIDE, ATTR_STRIDE>
{
    pub(crate) fn bind(ds: EntryStoreReader<SYNAPSE_STRIDE, META_STRIDE, ATTR_STRIDE>) -> Self {
        SynapseChainReader { ds }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.ds.mem_start_offset()
    }

    pub fn mem_end_offset(&self) -> usize {
        self.ds.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.ds.tb_start_offset()
    }

    pub fn tb_end_offset(&self) -> usize {
        self.ds.tb_end_offset()
    }

    pub fn capacity(&self) -> usize {
        self.ds.capacity()
    }

    #[inline]
    pub fn get_synapse(&'_ self, slot: usize) -> SynapseReader<'_, META_STRIDE, ATTR_STRIDE> {
        SynapseReader::new(self.ds.get(slot))
    }
}
