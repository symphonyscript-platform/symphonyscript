use crate::metadata::mem_metadata_reader::MemMetadataReader;
use crate::metadata::tb_metadata_reader::TbMetadataReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::topology::network::network_reader::NetworkReader;
use crate::topology::network::synapse_reader::SynapseReader;
use crate::topology::node::node_reader::NodeReader;

/// Consumer-side graph and topology orchestrator.
///
/// Provides the unified API for traversing the lock-free and wait-free graph
/// topology and attributes.
/// It encapsulates the underlying memory hierarchy and processes incoming structural updates
/// by the producer via `swap()`.
///
/// # Threading
/// Consumer thread only.
///
/// # Memory Layout
/// Shares backing MEM (direct plane) and TB (triple-buffered plane) regions
/// with `SynapticGraphWriter`. See its layout.
///
/// # Deployment
/// 1. `swap()` consumes any pending structural updates (node, synapses, tb_metadata) published
///    by the producer. Returns `true` if a new buffer was available, `false` otherwise.
/// 2. Non-structural updates (e.g. node/synapse attributes) and mem_metadata read directly
///    from the `mem` plane.
///
/// # Traits
/// - Memory sizing is defined at compile time via const generics.
/// - Created exclusively via `SynapticGraphWriter::to_reader()`.
#[derive(Clone)]
pub struct EpochMirror<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    tb: TripleBufferReader,
    mem_metadata: MemMetadataReader,
    tb_metadata: TbMetadataReader,
    network: NetworkReader<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
>
    EpochMirror<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >
{
    pub(crate) fn bind(
        tb: TripleBufferReader,
        mem_metadata: MemMetadataReader,
        tb_metadata: TbMetadataReader,
        network: NetworkReader<
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >,
    ) -> Self {
        EpochMirror {
            tb,
            mem_metadata,
            tb_metadata,
            network,
        }
    }

    pub fn mem_metadata_capacity(&self) -> usize {
        self.mem_metadata.capacity()
    }

    pub fn tb_metadata_capacity(&self) -> usize {
        self.tb_metadata.capacity()
    }

    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.mem_metadata.read(offset)
    }

    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.tb_metadata.read(offset)
    }

    pub fn get_head_node(
        &'_ self,
    ) -> Option<NodeReader<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>> {
        self.network.get_head()
    }

    pub fn get_node(
        &'_ self,
        slot: usize,
    ) -> NodeReader<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE> {
        self.network.get_node(slot)
    }

    pub fn get_synapse(
        &'_ self,
        slot: usize,
    ) -> SynapseReader<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        self.network.get_synapse(slot)
    }

    pub fn swap(&self) -> bool {
        let swapped = self.tb.swap();
        self.network.ack_generation();
        swapped
    }
}
