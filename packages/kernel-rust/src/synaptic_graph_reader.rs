use crate::attributes::reader::attribute_plane_reader::AttributePlaneReader;
use crate::attributes::reader::attributes_reader::AttributesReader;
use crate::constants::{
    NODE_ATTRIBUTES_SLOT_SIZE, NODE_SLOT_SIZE, SYNAPSE_ATTRIBUTES_SLOT_SIZE, SYNAPSE_SLOT_SIZE,
};
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferReader};
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_chain_reader::NodeChainReader;
use crate::structural_plane::node::node_reader::NodeReader;
use crate::structural_plane::structural_reader::StructuralReader;
use crate::structural_plane::synapse::synapse_chain_reader::SynapseChainReader;
use crate::structural_plane::synapse::synapse_reader::SynapseReader;
use crate::synaptic_graph_writer::{SynapticGraphConfig, SynapticGraphWriter};
use std::sync::Arc;

#[derive(Clone)]
pub struct SynapticGraphReader {
    node_attribute_plane: AttributePlaneReader<NODE_ATTRIBUTES_SLOT_SIZE>,
    synapse_attribute_plane: AttributePlaneReader<SYNAPSE_ATTRIBUTES_SLOT_SIZE>,
    triple_buffer_reader: TripleBufferReader,
    node_chain_reader: NodeChainReader,
    synapse_chain_reader: SynapseChainReader,
}

impl SynapticGraphReader {
    pub fn bind(sab: SAB, config: SynapticGraphConfig) -> Self {
        let node_attribute_plane = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            SynapticGraphWriter::compute_headers_size(&config),
            config.max_nodes,
        );
        let synapse_attribute_plane = AttributePlaneReader::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            node_attribute_plane.end_index(),
            config.max_synapses,
        );
        let triple_buffer_size = SynapticGraphWriter::compute_triple_buffer_size(&config);
        let triple_buffer_reader = TripleBuffer::bind_reader(
            Arc::clone(&sab),
            synapse_attribute_plane.end_index(),
            triple_buffer_size,
        );
        let buffer_head_offset = 0;
        let node_structural_reader = StructuralReader::<NODE_SLOT_SIZE>::bind(
            triple_buffer_reader.clone(),
            buffer_head_offset + 1,
            config.max_nodes,
        );
        let synapse_structural_reader = StructuralReader::<SYNAPSE_SLOT_SIZE>::bind(
            triple_buffer_reader.clone(),
            node_structural_reader.end_offset(),
            config.max_synapses,
        );
        let node_chain_reader = NodeChainReader::bind(
            triple_buffer_reader.clone(),
            node_structural_reader.clone(),
            buffer_head_offset,
        );
        let synapse_chain_reader = SynapseChainReader::bind(synapse_structural_reader.clone());

        SynapticGraphReader {
            node_attribute_plane,
            synapse_attribute_plane,
            triple_buffer_reader,
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
    ) -> AttributesReader<NODE_ATTRIBUTES_SLOT_SIZE> {
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
    ) -> AttributesReader<SYNAPSE_ATTRIBUTES_SLOT_SIZE> {
        self.synapse_attribute_plane.get(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.synapse_attribute_plane
            .get(slot)
            .read(attribute_offset)
    }

    pub fn swap(&mut self) -> bool {
        self.triple_buffer_reader.swap()
    }
}
