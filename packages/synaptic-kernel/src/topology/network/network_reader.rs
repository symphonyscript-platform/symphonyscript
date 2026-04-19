use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::topology::network::synapse_reader::SynapseReader;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_reader::NodeReader;

/// Consumer-side triple-buffered multi-linked list for graph synapses.
///
/// Provides read-only structural traversal of the synapse topology.
///
/// # Threading
/// Consumer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// Shares backing region with `NetworkWriter`. See its layout.
///
/// # Constraints
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Created exclusively via `NetworkWriter::to_reader()`.
#[derive(Clone)]
pub struct NetworkReader<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    node_chain: NodeChainReader<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
    pub(crate) synapses:
        EntryStoreReader<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
>
    NetworkReader<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >
{
    pub(crate) fn bind(
        node_chain: NodeChainReader<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
        synapses: EntryStoreReader<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
    ) -> Self {
        NetworkReader {
            node_chain,
            synapses,
        }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.synapses.mem_start_offset()
    }

    pub fn mem_end_offset(&self) -> usize {
        self.synapses.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.synapses.tb_start_offset()
    }

    pub fn tb_end_offset(&self) -> usize {
        self.synapses.tb_end_offset()
    }

    pub fn capacity(&self) -> usize {
        self.synapses.capacity()
    }

    #[inline]
    pub fn get_head_node(
        &'_ self,
    ) -> Option<NodeReader<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>> {
        self.node_chain.get_head_node()
    }

    #[inline]
    pub fn get_node(
        &'_ self,
        slot: usize,
    ) -> NodeReader<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE> {
        self.node_chain.get_node(slot)
    }

    #[inline]
    pub fn get_synapse(
        &'_ self,
        slot: usize,
    ) -> SynapseReader<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        SynapseReader::new(self.synapses.get(slot))
    }

    #[inline]
    pub fn ack_generation(&'_ self) {
        self.node_chain.ack_generation();
        self.synapses.ack_generation();
    }
}
