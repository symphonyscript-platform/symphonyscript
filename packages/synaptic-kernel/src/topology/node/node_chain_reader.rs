use crate::constants::NODE_STRIDE;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::topology::node::node_reader::NodeReader;

/// Consumer-side triple-buffered doubly-linked list for graph nodes.
///
/// Provides read-only structural traversal of the node topology.
///
/// # Threading
/// Consumer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// Shares backing region with `NodeChainWriter`. See its layout.
///
/// # Constraints
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Created exclusively via `NodeChainWriter::to_reader()`.
#[derive(Clone)]
pub struct NodeChainReader<const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    tb: TripleBufferReader,
    pub(crate) nodes: EntryStoreReader<NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
    tb_head_offset: usize,
}

impl<const META_STRIDE: usize, const ATTR_STRIDE: usize> NodeChainReader<META_STRIDE, ATTR_STRIDE> {
    pub(crate) fn bind(
        tb: TripleBufferReader,
        es: EntryStoreReader<NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
        tb_head_offset: usize,
    ) -> Self {
        NodeChainReader {
            tb,
            nodes: es,
            tb_head_offset,
        }
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_head_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.nodes.tb_end_offset()
    }

    pub fn capacity(&self) -> usize {
        self.nodes.capacity()
    }

    #[inline]
    pub fn get_head_slot(&self) -> usize {
        self.tb.read(self.tb_head_offset) as usize
    }

    #[inline]
    pub fn get_head_node(&'_ self) -> Option<NodeReader<'_, META_STRIDE, ATTR_STRIDE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node(head_slot))
    }

    #[inline]
    pub fn get_node(&'_ self, slot: usize) -> NodeReader<'_, META_STRIDE, ATTR_STRIDE> {
        NodeReader::new(self.nodes.get(slot))
    }

    #[inline]
    pub fn ack_generation(&'_ self) {
        self.nodes.ack_generation()
    }
}
