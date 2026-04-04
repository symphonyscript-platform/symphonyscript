use crate::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use crate::attribute_plane::writer::attributes_writer::AttributesWriter;
use crate::constants::{
    GRAPH_MAGIC, KERNEL_VERSION, NODE_ATTRIBUTES_SLOT_SIZE,
    SYNAPSE_ATTRIBUTES_SLOT_SIZE,
};
use crate::errors::free_list_error::FreeListError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferWriter};
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
use crate::structural_plane::node::node_data::NodeDraft;
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
use crate::structural_plane::synapse::synapse_data::SynapseDraft;
use crate::structural_plane::synapse::synapse_writer::SynapseWriter;
use crate::synaptic_graph_config::SynapticGraphConfig;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct SynapticGraphWriter {
    sab: SAB,
    node_attribute_plane: AttributePlaneWriter<NODE_ATTRIBUTES_SLOT_SIZE>,
    synapse_attribute_plane: AttributePlaneWriter<SYNAPSE_ATTRIBUTES_SLOT_SIZE>,
    triple_buffer_writer: TripleBufferWriter,
    node_chain_writer: NodeChainWriter,
    synapse_chain_writer: SynapseChainWriter,
}

impl SynapticGraphWriter {
    pub const HEADERS_SIZE: usize = 2;

    pub fn new(sab: SAB, config: SynapticGraphConfig) -> Self {
        assert!(
            sab[0].load(Ordering::Acquire) == 0 && sab[1].load(Ordering::Acquire) == 0,
            "Attempted to initialize SynapticGraphWriter on already allocated memory"
        );

        assert!(
            sab.len() >= Self::compute_size(&config),
            "Provided SAB is too small for this configuration"
        );

        sab[0].store(GRAPH_MAGIC, Ordering::Release);
        sab[1].store(KERNEL_VERSION, Ordering::Release);

        let sab_start_index = 2;
        let triple_buffer_start_offset = 0;

        let node_attribute_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(
            Arc::clone(&sab),
            sab_start_index,
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::new(
            Arc::clone(&sab),
            node_attribute_plane.sab_end_index(),
            config.synapse_capacity,
        );
        let (triple_buffer_writer, _) = TripleBuffer::new(
            Arc::clone(&sab),
            synapse_attribute_plane.sab_end_index(),
            Self::compute_triple_buffer_size(&config),
        );
        let node_chain_writer = NodeChainWriter::new(
            Arc::clone(&sab),
            triple_buffer_writer.clone(),
            triple_buffer_writer.sab_end_index(),
            triple_buffer_start_offset,
            config.node_capacity,
        );
        let synapse_chain_writer = SynapseChainWriter::new(
            Arc::clone(&sab),
            triple_buffer_writer.clone(),
            node_chain_writer.clone(),
            node_chain_writer.sab_end_index(),
            node_chain_writer.triple_buffer_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphWriter {
            sab,
            node_attribute_plane,
            synapse_attribute_plane,
            triple_buffer_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn bind(sab: SAB, config: SynapticGraphConfig) -> Self {
        assert_eq!(
            sab[0].load(Ordering::Acquire),
            GRAPH_MAGIC,
            "Attempted to initialize SynapticGraphWriter on foreign memory"
        );
        assert_eq!(
            sab[1].load(Ordering::Acquire),
            KERNEL_VERSION,
            "Attempted to initialize SynapticGraphWriter on mismatched SAB version"
        );

        assert!(
            sab.len() >= Self::compute_size(&config),
            "Provided SAB is too small for this configuration"
        );

        let sab_start_index = 2;
        let triple_buffer_start_offset = 0;

        let node_attribute_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            sab_start_index,
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            node_attribute_plane.sab_end_index(),
            config.synapse_capacity,
        );
        let triple_buffer_writer = TripleBuffer::bind_writer(
            Arc::clone(&sab),
            synapse_attribute_plane.sab_end_index(),
            Self::compute_triple_buffer_size(&config),
        );
        let node_chain_writer = NodeChainWriter::bind(
            Arc::clone(&sab),
            triple_buffer_writer.clone(),
            triple_buffer_writer.sab_end_index(),
            triple_buffer_start_offset,
            config.node_capacity,
        );
        let synapse_chain_writer = SynapseChainWriter::bind(
            Arc::clone(&sab),
            triple_buffer_writer.clone(),
            node_chain_writer.clone(),
            node_chain_writer.sab_end_index(),
            node_chain_writer.triple_buffer_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphWriter {
            sab,
            node_attribute_plane,
            synapse_attribute_plane,
            triple_buffer_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn compute_triple_buffer_size(config: &SynapticGraphConfig) -> usize {
        NodeChainWriter::compute_size_on_triple_buffer(config.node_capacity)
            + SynapseChainWriter::compute_size_on_triple_buffer(config.synapse_capacity)
    }

    pub fn compute_size(config: &SynapticGraphConfig) -> usize {
        Self::HEADERS_SIZE
            + NodeChainWriter::compute_size_on_sab(config.node_capacity)
            + SynapseChainWriter::compute_size_on_sab(config.synapse_capacity)
            + AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::calculate_size(
                config.node_capacity,
            )
            + AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::calculate_size(
                config.synapse_capacity,
            )
            + TripleBuffer::calculate_size(Self::compute_triple_buffer_size(config))
    }

    pub fn node_capacity(&self) -> usize {
        self.node_chain_writer.capacity()
    }

    pub fn node_count(&self) -> usize {
        self.node_chain_writer.count()
    }

    pub fn node_utilization(&self) -> f32 {
        self.node_chain_writer.utilization()
    }

    pub fn synapse_capacity(&self) -> usize {
        self.synapse_chain_writer.capacity()
    }

    pub fn synapse_count(&self) -> usize {
        self.synapse_chain_writer.count()
    }

    pub fn synapse_utilization(&self) -> f32 {
        self.synapse_chain_writer.utilization()
    }

    pub fn peek_utilization(&self) -> f32 {
        self.node_utilization().max(self.synapse_utilization())
    }

    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_>> {
        self.node_chain_writer.get_head()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_> {
        self.node_chain_writer.get(slot)
    }

    pub fn get_node_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<NODE_ATTRIBUTES_SLOT_SIZE> {
        self.node_attribute_plane.get(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.node_attribute_plane.get(slot).read(attribute_offset)
    }

    pub fn set_node_attributes<T: IntoArray<NODE_ATTRIBUTES_SLOT_SIZE>>(
        &'_ self,
        slot: usize,
        data: T,
    ) {
        self.node_attribute_plane.set(slot, data)
    }

    pub fn set_node_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.node_attribute_plane
            .get(slot)
            .write(attribute_offset, value)
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        self.node_chain_writer.insert_head(data)
    }

    pub fn insert_after(&self, prev_slot: usize, data: NodeDraft) -> Option<usize> {
        self.node_chain_writer.insert_after(prev_slot, data)
    }

    pub fn insert_before(&self, next_slot: usize, data: NodeDraft) -> Option<usize> {
        self.node_chain_writer.insert_before(next_slot, data)
    }

    pub fn remove_node(&self, slot: usize) {
        self.node_chain_writer.remove(slot);
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_> {
        self.synapse_chain_writer.get(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<SYNAPSE_ATTRIBUTES_SLOT_SIZE> {
        self.synapse_attribute_plane.get(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.synapse_attribute_plane
            .get(slot)
            .read(attribute_offset)
    }

    pub fn set_synapse_attributes<T: IntoArray<SYNAPSE_ATTRIBUTES_SLOT_SIZE>>(
        &'_ self,
        slot: usize,
        data: T,
    ) {
        self.synapse_attribute_plane.set(slot, data)
    }

    pub fn set_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.synapse_attribute_plane
            .get(slot)
            .write(attribute_offset, value)
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        data: SynapseDraft,
    ) -> Option<usize> {
        self.synapse_chain_writer
            .connect(source_slot, target_slot, data)
    }

    pub fn disconnect(&self, slot: usize) {
        self.synapse_chain_writer.disconnect(slot);
    }

    pub fn publish(&mut self) -> Result<(), FreeListError> {
        self.node_chain_writer.free_deferred_slots()?;
        self.synapse_chain_writer.free_deferred_slots()?;
        self.triple_buffer_writer.publish();
        Ok(())
    }

    pub fn get_sab(&self) -> SAB {
        Arc::clone(&self.sab)
    }

    pub fn copy_from(&mut self, source: &SynapticGraphWriter) {
        // self.node_free_list.copy_from(&source.node_free_list);
        // self.synapse_free_list.copy_from(&source.synapse_free_list);
        // self.node_deferred_frees_list
        //     .copy_from(&source.node_deferred_frees_list);
        // self.synapse_deferred_frees_list
        //     .copy_from(&source.synapse_deferred_frees_list);
        // self.node_attribute_plane
        //     .copy_from(&source.node_attribute_plane);
        // self.synapse_attribute_plane
        //     .copy_from(&source.synapse_attribute_plane);
        // self.triple_buffer_writer
        //     .copy_from(&source.triple_buffer_writer);
    }
}
