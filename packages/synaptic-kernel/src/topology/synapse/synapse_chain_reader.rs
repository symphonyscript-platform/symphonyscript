use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::dual_store_reader::DualStoreReader;
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
    ds: DualStoreReader<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
}

impl<const SYNAPSE_META_STRIDE: usize, const SYNAPSE_ATTRIBUTES_STRIDE: usize>
    SynapseChainReader<SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>
{
    pub(crate) fn bind(
        ds: DualStoreReader<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
    ) -> Self {
        SynapseChainReader { ds }
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
    pub fn core_read(&self, slot: usize, offset: usize) -> i32 {
        self.ds.core_read(slot, offset)
    }

    #[inline]
    pub fn core_read_all(&self, slot: usize) -> [i32; SYNAPSE_STRIDE] {
        self.ds.core_read_all(slot)
    }

    #[inline]
    pub fn meta_read(&self, slot: usize, offset: usize) -> i32 {
        self.ds.meta_read(slot, offset)
    }

    #[inline]
    pub fn meta_read_all(&self, slot: usize) -> [i32; SYNAPSE_META_STRIDE] {
        self.ds.meta_read_all(slot)
    }

    #[inline]
    pub fn attr_read(&self, slot: usize, offset: usize) -> i32 {
        self.ds.attr_read(slot, offset)
    }

    #[inline]
    pub fn attr_read_all(&self, slot: usize) -> [i32; SYNAPSE_ATTRIBUTES_STRIDE] {
        self.ds.attr_read_all(slot)
    }

    #[inline]
    pub fn get_synapse(&'_ self, slot: usize) -> SynapseReader<'_, SYNAPSE_META_STRIDE> {
        SynapseReader::new(self.ds.get_struct(slot))
    }
}
