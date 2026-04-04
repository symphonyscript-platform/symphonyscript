use crate::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::constants::{
    NODE_ATTRIBUTES_SLOT_SIZE, SYNAPSE_ATTRIBUTES_SLOT_SIZE,
};
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferReader};
use crate::primitives::types::AtomicBuffer;
use crate::structural_plane::node::node_chain_reader::NodeChainReader;
use crate::structural_plane::node::node_reader::NodeReader;
use crate::structural_plane::synapse::synapse_chain_reader::SynapseChainReader;
use crate::structural_plane::synapse::synapse_reader::SynapseReader;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::synaptic_graph_writer::SynapticGraphWriter;
use std::sync::Arc;

#[derive(Clone)]
pub struct SynapticGraphReader {
    node_attribute_plane: AttributePlaneReader<NODE_ATTRIBUTES_SLOT_SIZE>,
    synapse_attribute_plane: AttributePlaneReader<SYNAPSE_ATTRIBUTES_SLOT_SIZE>,
    tb_reader: TripleBufferReader,
    node_chain_reader: NodeChainReader,
    synapse_chain_reader: SynapseChainReader,
}

impl SynapticGraphReader {
    pub fn bind(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        let mem_start_offset = SynapticGraphWriter::HEADERS_SIZE;
        let tb_start_offset = 0;

        let node_attribute_plane = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&mem),
            mem_start_offset,
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneReader::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&mem),
            node_attribute_plane.mem_end_offset(),
            config.synapse_capacity,
        );
        let tb_size = SynapticGraphWriter::compute_tb_size(&config);
        let tb_reader = TripleBuffer::bind_reader(
            Arc::clone(&mem),
            synapse_attribute_plane.mem_end_offset(),
            tb_size,
        );
        let node_chain_reader = NodeChainReader::bind(
            tb_reader.clone(),
            tb_start_offset,
            config.node_capacity,
        );
        let synapse_chain_reader = SynapseChainReader::bind(
            tb_reader.clone(),
            node_chain_reader.tb_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphReader {
            node_attribute_plane,
            synapse_attribute_plane,
            tb_reader,
            node_chain_reader,
            synapse_chain_reader,
        }
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
    ) -> AttributesReader<'_, NODE_ATTRIBUTES_SLOT_SIZE> {
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
    ) -> AttributesReader<'_, SYNAPSE_ATTRIBUTES_SLOT_SIZE> {
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
