use crate::attributes::attribute_plane_reader::AttributePlaneReader;
use crate::attributes::attributes_reader::AttributesReader;
use crate::metadata::mem_metadata_reader::MemMetadataReader;
use crate::metadata::tb_metadata_reader::TbMetadataReader;
use crate::primitives::staging_buffer_reader::StagingBufferReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_reader::NodeReader;
use crate::topology::synapse::synapse_chain_reader::SynapseChainReader;
use crate::topology::synapse::synapse_reader::SynapseReader;

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
pub struct SynapticGraphReader<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    mem_metadata_plane: MemMetadataReader,
    tb_metadata_plane: TbMetadataReader,
    node_attribute_plane: AttributePlaneReader<NODE_ATTRIBUTES_SIZE>,
    synapse_attribute_plane: AttributePlaneReader<SYNAPSE_ATTRIBUTES_SIZE>,
    tb_reader: TripleBufferReader,
    node_chain_reader: NodeChainReader<NODE_META_SIZE>,
    synapse_chain_reader: SynapseChainReader<NODE_META_SIZE, SYNAPSE_META_SIZE>,
    node_staging_buffer_reader: StagingBufferReader,
    synapse_staging_buffer_reader: StagingBufferReader,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
>
    SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >
{
    pub(crate) fn bind(
        mem_metadata_plane: MemMetadataReader,
        node_attribute_plane: AttributePlaneReader<NODE_ATTRIBUTES_SIZE>,
        synapse_attribute_plane: AttributePlaneReader<SYNAPSE_ATTRIBUTES_SIZE>,
        tb_reader: TripleBufferReader,
        tb_metadata_plane: TbMetadataReader,
        node_chain_reader: NodeChainReader<NODE_META_SIZE>,
        synapse_chain_reader: SynapseChainReader<NODE_META_SIZE, SYNAPSE_META_SIZE>,
        node_staging_buffer_reader: StagingBufferReader,
        synapse_staging_buffer_reader: StagingBufferReader,
    ) -> Self {
        SynapticGraphReader {
            mem_metadata_plane,
            tb_metadata_plane,
            node_attribute_plane,
            synapse_attribute_plane,
            tb_reader,
            node_chain_reader,
            synapse_chain_reader,
            node_staging_buffer_reader,
            synapse_staging_buffer_reader,
        }
    }

    pub fn mem_metadata_capacity(&self) -> usize {
        self.mem_metadata_plane.capacity()
    }

    pub fn tb_metadata_capacity(&self) -> usize {
        self.tb_metadata_plane.capacity()
    }

    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.mem_metadata_plane.read(offset)
    }

    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.tb_metadata_plane.read(offset)
    }

    pub fn get_head_node(&'_ self) -> Option<NodeReader<'_, NODE_META_SIZE>> {
        self.node_chain_reader.get_head()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeReader<'_, NODE_META_SIZE> {
        self.node_chain_reader.get_node(slot)
    }

    pub fn get_node_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesReader<'_, NODE_ATTRIBUTES_SIZE> {
        self.node_attribute_plane.get(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.node_attribute_plane.get(slot).read(attribute_offset)
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseReader<'_, SYNAPSE_META_SIZE> {
        self.synapse_chain_reader.get(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesReader<'_, SYNAPSE_ATTRIBUTES_SIZE> {
        self.synapse_attribute_plane.get(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.synapse_attribute_plane.get(slot).read(attribute_offset)
    }

    pub fn swap(&self) -> bool {
        let swapped = self.tb_reader.swap();
        self.ack_node_generation();
        self.ack_synapse_generation();
        swapped
    }

    fn ack_node_generation(&self) {
        self.node_staging_buffer_reader.ack();
    }

    fn ack_synapse_generation(&self) {
        self.synapse_staging_buffer_reader.ack();
    }
}
