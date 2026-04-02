use crate::attributes::attribute_plane::AttributePlane;
use crate::attributes::attributes_view::AttributesView;
use crate::constants::{
    NODE_ATTRIBUTES_SLOT_SIZE, NODE_SLOT_SIZE, SYNAPSE_ATTRIBUTES_SLOT_SIZE, SYNAPSE_SLOT_SIZE,
};
use crate::errors::free_list_error::FreeListError;
use crate::primitives::deferred_frees_list::DeferredFreesList;
use crate::primitives::into_array::IntoArray;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferWriter};
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
use crate::structural_plane::node::node_data::NodeDraft;
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::structural_writer::StructuralWriter;
use crate::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
use crate::structural_plane::synapse::synapse_data::SynapseDraft;
use crate::structural_plane::synapse::synapse_writer::SynapseWriter;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;

pub struct KernelConfig {
    pub max_nodes: usize,
    pub max_synapses: usize,
}

#[derive(Clone)]
pub struct Kernel {
    node_free_list: SimpleFreeList,
    synapse_free_list: SimpleFreeList,
    node_deferred_frees_list: DeferredFreesList,
    synapse_deferred_frees_list: DeferredFreesList,
    node_attribute_plane: AttributePlane<NODE_ATTRIBUTES_SLOT_SIZE>,
    synapse_attribute_plane: AttributePlane<SYNAPSE_ATTRIBUTES_SLOT_SIZE>,
    triple_buffer_writer: TripleBufferWriter,
    node_chain_writer: NodeChainWriter,
    synapse_chain_writer: SynapseChainWriter,
}

impl Kernel {
    pub fn new(config: KernelConfig) -> Self {
        let sab = Self::create_sab(Self::compute_sab_size(&config));
        let node_free_list = SimpleFreeList::new(Arc::clone(&sab), 1, config.max_nodes);
        let synapse_free_list = SimpleFreeList::new(
            Arc::clone(&sab),
            node_free_list.end_index(),
            config.max_synapses,
        );
        let node_deferred_frees_list = DeferredFreesList::new(
            Arc::clone(&sab),
            synapse_free_list.end_index(),
            config.max_nodes,
        );
        let synapse_deferred_frees_list = DeferredFreesList::new(
            Arc::clone(&sab),
            node_deferred_frees_list.end_index(),
            config.max_synapses,
        );
        let node_attribute_plane = AttributePlane::<NODE_ATTRIBUTES_SLOT_SIZE>::new(
            Arc::clone(&sab),
            synapse_deferred_frees_list.end_index(),
            config.max_nodes,
        );
        let synapse_attribute_plane = AttributePlane::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::new(
            Arc::clone(&sab),
            node_attribute_plane.end_index(),
            config.max_synapses,
        );
        let (triple_buffer_writer, _) = TripleBuffer::new(
            Arc::clone(&sab),
            synapse_attribute_plane.end_index(),
            Self::compute_triple_buffer_size(&config),
        );
        let buffer_head_offset = 0;
        let node_structural_writer = StructuralWriter::<NODE_SLOT_SIZE>::new(
            triple_buffer_writer.clone(),
            node_free_list.clone(),
            buffer_head_offset + 1,
            config.max_nodes,
        );
        let synapse_structural_writer = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(
            triple_buffer_writer.clone(),
            synapse_free_list.clone(),
            node_structural_writer.end_offset(),
            config.max_synapses,
        );
        let node_chain_writer = NodeChainWriter::new(
            triple_buffer_writer.clone(),
            node_structural_writer.clone(),
            buffer_head_offset,
        );
        let synapse_chain_writer =
            SynapseChainWriter::new(node_chain_writer.clone(), synapse_structural_writer.clone());

        Kernel {
            node_free_list,
            synapse_free_list,
            node_deferred_frees_list,
            synapse_deferred_frees_list,
            node_attribute_plane,
            synapse_attribute_plane,
            triple_buffer_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn bind(sab: SAB, config: KernelConfig) -> Self {
        let node_free_list = SimpleFreeList::bind(Arc::clone(&sab), 1, config.max_nodes);
        let synapse_free_list = SimpleFreeList::bind(
            Arc::clone(&sab),
            node_free_list.end_index(),
            config.max_synapses,
        );
        let node_deferred_frees_list = DeferredFreesList::bind(
            Arc::clone(&sab),
            synapse_free_list.end_index(),
            config.max_nodes,
        );
        let synapse_deferred_frees_list = DeferredFreesList::bind(
            Arc::clone(&sab),
            node_deferred_frees_list.end_index(),
            config.max_synapses,
        );
        let node_attribute_plane = AttributePlane::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            synapse_deferred_frees_list.end_index(),
            config.max_nodes,
        );
        let synapse_attribute_plane = AttributePlane::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::bind(
            Arc::clone(&sab),
            node_attribute_plane.end_index(),
            config.max_synapses,
        );
        let triple_buffer_size = Self::compute_triple_buffer_size(&config);
        let triple_buffer_writer = TripleBuffer::bind_writer(
            Arc::clone(&sab),
            synapse_attribute_plane.end_index(),
            triple_buffer_size,
        );
        let buffer_head_offset = 0;
        let node_structural_writer = StructuralWriter::<NODE_SLOT_SIZE>::bind(
            triple_buffer_writer.clone(),
            node_free_list.clone(),
            buffer_head_offset + 1,
            config.max_nodes,
        );
        let synapse_structural_writer = StructuralWriter::<SYNAPSE_SLOT_SIZE>::bind(
            triple_buffer_writer.clone(),
            synapse_free_list.clone(),
            node_structural_writer.end_offset(),
            config.max_synapses,
        );
        let node_chain_writer = NodeChainWriter::bind(
            triple_buffer_writer.clone(),
            node_structural_writer.clone(),
            buffer_head_offset,
        );
        let synapse_chain_writer =
            SynapseChainWriter::bind(node_chain_writer.clone(), synapse_structural_writer.clone());

        Kernel {
            node_free_list,
            synapse_free_list,
            node_deferred_frees_list,
            synapse_deferred_frees_list,
            node_attribute_plane,
            synapse_attribute_plane,
            triple_buffer_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn compute_triple_buffer_size(config: &KernelConfig) -> usize {
        NODE_SLOT_SIZE * config.max_nodes + SYNAPSE_SLOT_SIZE * config.max_synapses
    }

    pub fn compute_sab_size(config: &KernelConfig) -> usize {
        let structural_plane_size =
            TripleBuffer::calculate_size(Self::compute_triple_buffer_size(config));
        let node_free_list_size = SimpleFreeList::calculate_size(config.max_nodes);
        let synapse_free_list_size = SimpleFreeList::calculate_size(config.max_synapses);
        let node_attribute_plane_size =
            AttributePlane::<NODE_ATTRIBUTES_SLOT_SIZE>::calculate_size(config.max_nodes);
        let synapse_attribute_plane_size =
            AttributePlane::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::calculate_size(config.max_synapses);
        let node_deferred_free_list_size = DeferredFreesList::calculate_size(config.max_nodes);
        let synapse_deferred_free_list_size =
            DeferredFreesList::calculate_size(config.max_synapses);

        1 + structural_plane_size
            + node_free_list_size
            + synapse_free_list_size
            + node_attribute_plane_size
            + synapse_attribute_plane_size
            + node_deferred_free_list_size
            + synapse_deferred_free_list_size
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_> {
        self.node_chain_writer.get(slot)
    }

    pub fn get_node_attributes(&'_ self, slot: usize) -> AttributesView<NODE_ATTRIBUTES_SLOT_SIZE> {
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

    pub fn remove_node(&self, slot: usize) -> Result<(), FreeListError> {
        self.node_chain_writer.remove(slot)?;
        self.node_deferred_frees_list.push(slot);
        Ok(())
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_> {
        self.synapse_chain_writer.get(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesView<SYNAPSE_ATTRIBUTES_SLOT_SIZE> {
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

    pub fn disconnect(&self, slot: usize) -> Result<(), FreeListError> {
        self.synapse_chain_writer.disconnect(slot)?;
        self.synapse_deferred_frees_list.push(slot);
        Ok(())
    }

    pub fn publish(&mut self) -> Result<(), FreeListError> {
        self.node_deferred_frees_list
            .free_deferred_slots(&self.node_free_list)?;
        self.synapse_deferred_frees_list
            .free_deferred_slots(&self.synapse_free_list)?;
        self.triple_buffer_writer.publish();
        Ok(())
    }

    fn create_sab(size: usize) -> SAB {
        let sab: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();

        Arc::new(sab)
    }
}
