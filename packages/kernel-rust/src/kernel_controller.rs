use crate::attribute_plane::writer::attributes_writer::AttributesWriter;
use crate::constants::{NODE_ATTRIBUTES_SLOT_SIZE, SYNAPSE_ATTRIBUTES_SLOT_SIZE};
use crate::control_plane::ControlPlane;
use crate::errors::free_list_error::FreeListError;
use crate::errors::kernel_error::KernelError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_data::NodeDraft;
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::synapse::synapse_data::SynapseDraft;
use crate::structural_plane::synapse::synapse_writer::SynapseWriter;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::synaptic_graph_reader::SynapticGraphReader;
use crate::synaptic_graph_writer::SynapticGraphWriter;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;

pub struct KernelController {
    control_plane: Box<ControlPlane>,
    active_writer: SynapticGraphWriter,
    active_reader: Box<SynapticGraphReader>,
    backlog: Option<Box<SynapticGraphReader>>,
    pending_deletion: Option<Box<SynapticGraphReader>>,
}

impl KernelController {
    pub fn new(config: SynapticGraphConfig) -> Self {
        let sab = Self::create_sab(SynapticGraphWriter::compute_size(&config));

        Self::new_from_sab(sab, config)
    }

    pub fn new_from_sab(sab: SAB, config: SynapticGraphConfig) -> Self {
        let writer = SynapticGraphWriter::new(Arc::clone(&sab), config.clone());
        let reader = SynapticGraphReader::bind(Arc::clone(&sab), config.clone());
        let reader_box = Box::new(reader);
        let reader_ptr =
            reader_box.as_ref() as *const SynapticGraphReader as *mut SynapticGraphReader;
        let control_plane = Box::new(ControlPlane::new(reader_ptr));

        KernelController {
            control_plane,
            active_writer: writer,
            active_reader: reader_box,
            backlog: None,
            pending_deletion: None,
        }
    }

    pub fn get_controller_plane_address(&self) -> usize {
        self.control_plane.as_ref() as *const ControlPlane as usize
    }

    pub fn node_capacity(&self) -> usize {
        self.active_writer.node_capacity()
    }

    pub fn node_count(&self) -> usize {
        self.active_writer.node_count()
    }

    pub fn node_utilization(&self) -> f32 {
        self.active_writer.node_utilization()
    }

    pub fn synapse_capacity(&self) -> usize {
        self.active_writer.synapse_capacity()
    }

    pub fn synapse_count(&self) -> usize {
        self.active_writer.synapse_count()
    }

    pub fn synapse_utilization(&self) -> f32 {
        self.active_writer.synapse_utilization()
    }

    pub fn peek_utilization(&self) -> f32 {
        self.active_writer.peek_utilization()
    }

    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_>> {
        self.active_writer.get_head_node()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_> {
        self.active_writer.get_node(slot)
    }

    pub fn get_node_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<NODE_ATTRIBUTES_SLOT_SIZE> {
        self.active_writer.get_node_attributes(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.active_writer
            .get_node_attribute(slot, attribute_offset)
    }

    pub fn set_node_attributes<T: IntoArray<NODE_ATTRIBUTES_SLOT_SIZE>>(
        &'_ self,
        slot: usize,
        data: T,
    ) {
        self.active_writer.set_node_attributes(slot, data)
    }

    pub fn set_node_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.active_writer
            .set_node_attribute(slot, attribute_offset, value)
    }

    pub fn insert_head(&self, data: NodeDraft) -> Result<usize, KernelError> {
        match self.active_writer.insert_head(data) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_after(&self, prev_slot: usize, data: NodeDraft) -> Result<usize, KernelError> {
        match self.active_writer.insert_after(prev_slot, data) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_before(&self, next_slot: usize, data: NodeDraft) -> Result<usize, KernelError> {
        match self.active_writer.insert_before(next_slot, data) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn remove_node(&self, slot: usize) {
        self.active_writer.remove_node(slot);
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_> {
        self.active_writer.get_synapse(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<SYNAPSE_ATTRIBUTES_SLOT_SIZE> {
        self.active_writer.get_synapse_attributes(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.active_writer
            .get_synapse_attribute(slot, attribute_offset)
    }

    pub fn set_synapse_attributes<T: IntoArray<SYNAPSE_ATTRIBUTES_SLOT_SIZE>>(
        &'_ self,
        slot: usize,
        data: T,
    ) {
        self.active_writer.set_synapse_attributes(slot, data)
    }

    pub fn set_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.active_writer
            .set_synapse_attribute(slot, attribute_offset, value)
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        data: SynapseDraft,
    ) -> Result<usize, KernelError> {
        match self.active_writer.connect(source_slot, target_slot, data) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn disconnect(&self, slot: usize) {
        self.active_writer.disconnect(slot);
    }

    pub fn publish(&mut self) -> Result<(), FreeListError> {
        self.active_writer.publish();
        self.pending_deletion = self.backlog.take();
        Ok(())
    }

    pub fn should_grow(&self, target_resize_threshold: f32) -> bool {
        self.active_writer.peek_utilization() > target_resize_threshold
    }

    pub fn grow(&mut self, config: SynapticGraphConfig) -> Result<(), KernelError> {
        if config.node_capacity < self.active_writer.node_capacity()
            || config.synapse_capacity < self.active_writer.synapse_capacity()
        {
            return Err(KernelError::InsufficientCapacity);
        }

        let sab = Self::create_sab(SynapticGraphWriter::compute_size(&config));
        let mut writer = SynapticGraphWriter::bind(Arc::clone(&sab), config.clone());

        writer.copy_from(&self.active_writer);

        let reader = SynapticGraphReader::bind(Arc::clone(&sab), config.clone());
        let reader_box = Box::new(reader);
        let reader_ptr =
            reader_box.as_ref() as *const SynapticGraphReader as *mut SynapticGraphReader;
        let old_reader = std::mem::replace(&mut self.active_reader, reader_box);
        self.active_writer = writer;
        self.backlog = Some(old_reader);
        self.control_plane.set_shared_graph_ptr(reader_ptr);

        Ok(())
    }

    fn create_sab(size: usize) -> SAB {
        let sab: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();

        Arc::new(sab)
    }
}
