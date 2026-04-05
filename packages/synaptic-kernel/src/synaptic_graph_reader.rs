use crate::attribute_plane::attribute_plane_reader::AttributePlaneReader;
use crate::attribute_plane::attributes_reader::AttributesReader;
use crate::metadata::mem_metadata_reader::MemMetadataReader;
use crate::metadata::tb_metadata_reader::TbMetadataReader;
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferReader};
use crate::primitives::types::AtomicBuffer;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::synaptic_graph_writer::SynapticGraphWriter;
use crate::topology::node::node_chain_reader::NodeChainReader;
use crate::topology::node::node_reader::NodeReader;
use crate::topology::synapse::synapse_chain_reader::SynapseChainReader;
use crate::topology::synapse::synapse_reader::SynapseReader;
use std::sync::Arc;

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
    node_chain_reader: NodeChainReader,
    synapse_chain_reader: SynapseChainReader,
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
    pub fn bind(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        let mem_start_offset = SynapticGraphWriter::<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::HEADERS_SIZE;
        let tb_start_offset = 0;

        let mem_metadata_plane =
            MemMetadataReader::bind(Arc::clone(&mem), mem_start_offset, config.mem_metadata_size);
        let node_attribute_plane = AttributePlaneReader::<NODE_ATTRIBUTES_SIZE>::bind(
            Arc::clone(&mem),
            mem_metadata_plane.mem_end_offset(),
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneReader::<SYNAPSE_ATTRIBUTES_SIZE>::bind(
            Arc::clone(&mem),
            node_attribute_plane.mem_end_offset(),
            config.synapse_capacity,
        );
        let tb_size = SynapticGraphWriter::<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::calculate_size_on_tb(&config);
        let tb_reader = TripleBuffer::bind_reader(
            Arc::clone(&mem),
            synapse_attribute_plane.mem_end_offset(),
            tb_size,
        );
        let tb_metadata_plane =
            TbMetadataReader::bind(tb_reader.clone(), tb_start_offset, config.tb_metadata_size);
        let node_chain_reader = NodeChainReader::bind(
            tb_reader.clone(),
            tb_metadata_plane.tb_end_offset(),
            config.node_capacity,
        );
        let synapse_chain_reader = SynapseChainReader::bind(
            tb_reader.clone(),
            node_chain_reader.tb_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphReader {
            mem_metadata_plane,
            tb_metadata_plane,
            node_attribute_plane,
            synapse_attribute_plane,
            tb_reader,
            node_chain_reader,
            synapse_chain_reader,
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

    pub fn get_head_node(&'_ self) -> Option<NodeReader<'_>> {
        self.node_chain_reader.get_head()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeReader<'_> {
        self.node_chain_reader.get(slot)
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

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseReader<'_> {
        self.synapse_chain_reader.get(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesReader<'_, SYNAPSE_ATTRIBUTES_SIZE> {
        self.synapse_attribute_plane.get(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.synapse_attribute_plane
            .get(slot)
            .read(attribute_offset)
    }

    pub fn swap(&mut self) -> bool {
        self.tb_reader.swap()
    }
}
