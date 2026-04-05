use crate::attribute_plane::attributes_writer::AttributesWriter;
use crate::control_plane::ControlPlane;
use crate::errors::free_list_error::FreeListError;
use crate::errors::kernel_error::KernelError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::AtomicBuffer;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::synaptic_graph_reader::SynapticGraphReader;
use crate::synaptic_graph_writer::SynapticGraphWriter;
use crate::topology::node::node_data::NodeDraft;
use crate::topology::node::node_writer::NodeWriter;
use crate::topology::synapse::synapse_data::SynapseDraft;
use crate::topology::synapse::synapse_writer::SynapseWriter;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;

pub struct KernelController<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    control_plane: Box<
        ControlPlane<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
    active_writer: SynapticGraphWriter<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >,
    active_reader: Box<
        SynapticGraphReader<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
    backlog: Option<
        Box<
            SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    >,
    pending_deletion: Option<
        Box<
            SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    >,
}

impl<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
>
    KernelController<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >
{
    pub fn new(config: SynapticGraphConfig) -> Self {
        let mem = Self::create_mem(SynapticGraphWriter::<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::calculate_size_on_mem(&config));
        Self::new_from_mem(mem, config)
    }

    pub fn new_from_mem(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        let writer = SynapticGraphWriter::new(Arc::clone(&mem), config.clone());
        let reader = SynapticGraphReader::bind(Arc::clone(&mem), config.clone());
        let reader_box = Box::new(reader);
        let reader_ptr = reader_box.as_ref()
            as *const SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >
            as *mut SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >;
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
        self.control_plane.as_ref()
            as *const ControlPlane<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            > as usize
    }

    pub fn mem_metadata_capacity(&self) -> usize {
        self.active_writer.mem_metadata_capacity()
    }

    pub fn tb_metadata_capacity(&self) -> usize {
        self.active_writer.tb_metadata_capacity()
    }

    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.active_writer.mem_read_meta(offset)
    }

    pub fn mem_write_meta(&self, offset: usize, value: i32) {
        self.active_writer.mem_write_meta(offset, value);
    }

    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.active_writer.tb_read_meta(offset)
    }

    pub fn tb_write_meta(&self, offset: usize, value: i32) {
        self.active_writer.tb_write_meta(offset, value);
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

    pub fn get_head_node_slot(&'_ self) -> usize {
        self.active_writer.get_head_node_slot()
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
    ) -> AttributesWriter<'_, NODE_ATTRIBUTES_SIZE> {
        self.active_writer.get_node_attributes(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.active_writer
            .get_node_attribute(slot, attribute_offset)
    }

    pub fn set_node_attributes<T: IntoArray<NODE_ATTRIBUTES_SIZE>>(&'_ self, slot: usize, data: T) {
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

    pub fn remove_node(&self, slot: usize) -> Result<(), FreeListError> {
        self.active_writer.remove_node(slot)
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_> {
        self.active_writer.get_synapse(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<'_, SYNAPSE_ATTRIBUTES_SIZE> {
        self.active_writer.get_synapse_attributes(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.active_writer
            .get_synapse_attribute(slot, attribute_offset)
    }

    pub fn set_synapse_attributes<T: IntoArray<SYNAPSE_ATTRIBUTES_SIZE>>(
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

    pub fn disconnect(&self, slot: usize) -> Result<(), FreeListError> {
        self.active_writer.disconnect(slot)
    }

    pub fn publish(&mut self) {
        self.active_writer.publish();
        self.pending_deletion = self.backlog.take();
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

        let mem = Self::create_mem(SynapticGraphWriter::<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::calculate_size_on_mem(&config));
        let writer = SynapticGraphWriter::new(Arc::clone(&mem), config.clone());

        writer.copy_from(&self.active_writer);

        let new_reader = Box::new(SynapticGraphReader::bind(Arc::clone(&mem), config.clone()));

        self.active_writer = writer;
        self.backlog = Some(self.replace_reader(new_reader));

        Ok(())
    }

    fn replace_reader(
        &mut self,
        new_reader: Box<
            SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    ) -> Box<
        SynapticGraphReader<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    > {
        let new_reader_ptr = new_reader.as_ref()
            as *const SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >
            as *mut SynapticGraphReader<
                NODE_FRAME_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_FRAME_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >;
        let old_reader = std::mem::replace(&mut self.active_reader, new_reader);
        self.control_plane.set_shared_graph_ptr(new_reader_ptr);

        old_reader
    }

    fn create_mem(size: usize) -> AtomicBuffer {
        let mem: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();

        Arc::new(mem)
    }
}
