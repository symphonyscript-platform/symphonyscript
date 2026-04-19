use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::topology::network::synapse_reader::SynapseReader;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_reader::NodeReader;

/// Consumer-side mirror of the node and synapse topology.
///
/// Provides read-only traversal across both chains. Callers walk the graph
/// starting from the head node (`graph_head_node()`), follow `get_next_ptr()`
/// through the node chain, and dereference `get_outgoing_synapse_head()` /
/// `get_incoming_synapse_head()` on each node to walk its synapse lists.
///
/// # Threading
/// Consumer thread only.
///
/// # Memory Layout
/// Shares the backing MEM and TB regions with `NetworkWriter`. See its layout.
///
/// # Constraints
/// - Read-only: structural mutation is strictly prohibited.
/// - Slots are 1-based. 0 denotes "no slot" / "undefined".
/// - No liveness check on random access: the reader does not carry the slot allocators,
///   so `get_note(slot)` and `get_synapse(slot)` return raw memory for whatever entity last
///   occupied that slot. Consumers MUST reach slots by traversing head pointers and next/prev
///   pointers of already-acquired entries. Random-access arbitrary slot is undefined.
/// - `ack_generation()` acknowledges both node and synapse deferred-deletion generations.
///   Invoked by `EpochMirror::swap()` - consumers do not call it directly.
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

    pub fn mem_end_offset(&self) -> usize {
        self.synapses.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.node_chain.tb_start_offset()
    }

    pub fn tb_end_offset(&self) -> usize {
        self.synapses.tb_end_offset()
    }

    pub fn node_capacity(&self) -> usize {
        self.node_chain.capacity()
    }

    pub fn synapse_capacity(&self) -> usize {
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
