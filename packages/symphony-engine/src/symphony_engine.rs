use crate::attribute_plane::writer::synapse_attributes_writer::SynapseAttributes;
use crate::constants::{
    NODE_ATTRIBUTES_SIZE, NODE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE,
};
use std::sync::Arc;
use synaptic_kernel::attribute_plane::attributes_writer::AttributesWriter;
use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::errors::kernel_error::KernelError;
use synaptic_kernel::errors::slot_allocator_error::SlotAllocatorError;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::serialized_kernel::SerializedKernel;
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;
use synaptic_kernel::topology::node::node_writer::NodeWriter;
use synaptic_kernel::topology::synapse::synapse_writer::SynapseWriter;

pub type SymphonyEngineKernel =
    Kernel<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>;
pub type SymphonyEngineControlPlane =
    ControlPlane<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>;

pub struct SymphonyEngine {
    kernel: SymphonyEngineKernel,
}

impl SymphonyEngine {
    pub fn new(config: SynapticGraphConfig) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::new(config),
        }
    }

    pub fn new_from_mem(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::new_from_mem(mem, config),
        }
    }

    pub fn load_serialized(serialized_kernel: SerializedKernel) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::load_serialized(serialized_kernel),
        }
    }

    pub fn serialize(&mut self) -> SerializedKernel {
        self.kernel.serialize()
    }

    pub fn get_control_plane(&self) -> Arc<SymphonyEngineControlPlane> {
        self.kernel.get_control_plane()
    }

    pub fn mem_metadata_capacity(&self) -> usize {
        self.kernel.mem_metadata_capacity()
    }

    pub fn tb_metadata_capacity(&self) -> usize {
        self.kernel.tb_metadata_capacity()
    }

    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.kernel.mem_read_meta(offset)
    }

    pub fn mem_write_meta(&self, offset: usize, value: i32) {
        self.kernel.mem_write_meta(offset, value);
    }

    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.kernel.tb_read_meta(offset)
    }

    pub fn tb_write_meta(&self, offset: usize, value: i32) {
        self.kernel.tb_write_meta(offset, value);
    }

    pub fn node_capacity(&self) -> usize {
        self.kernel.node_capacity()
    }

    pub fn node_count(&self) -> usize {
        self.kernel.node_count()
    }

    pub fn node_utilization(&self) -> f32 {
        self.kernel.node_utilization()
    }

    pub fn synapse_capacity(&self) -> usize {
        self.kernel.synapse_capacity()
    }

    pub fn synapse_count(&self) -> usize {
        self.kernel.synapse_count()
    }

    pub fn synapse_utilization(&self) -> f32 {
        self.kernel.synapse_utilization()
    }

    pub fn peek_utilization(&self) -> f32 {
        self.kernel.peek_utilization()
    }

    pub fn get_head_node_slot(&'_ self) -> usize {
        self.kernel.get_head_node_slot()
    }

    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_, NODE_META_SIZE>> {
        self.kernel.get_head_node()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_, NODE_META_SIZE> {
        self.kernel.get_node(slot)
    }

    pub fn get_node_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<'_, NODE_ATTRIBUTES_SIZE> {
        self.kernel.get_node_attributes(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.kernel.get_node_attribute(slot, attribute_offset)
    }

    pub fn set_node_attributes<T: IntoArray<NODE_ATTRIBUTES_SIZE>>(&'_ self, slot: usize, data: T) {
        self.kernel.set_node_attributes(slot, data)
    }

    pub fn set_node_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.kernel
            .set_node_attribute(slot, attribute_offset, value)
    }

    pub fn insert_head(&self, kind: i32) -> Result<usize, KernelError> {
        self.kernel.insert_head(kind)
    }

    pub fn insert_after(&self, prev_slot: usize, kind: i32) -> Result<usize, KernelError> {
        self.kernel.insert_after(prev_slot, kind)
    }

    pub fn insert_before(&self, next_slot: usize, kind: i32) -> Result<usize, KernelError> {
        self.kernel.insert_before(next_slot, kind)
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.kernel.remove_node(slot)
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_, SYNAPSE_META_SIZE> {
        self.kernel.get_synapse(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<'_, SYNAPSE_ATTRIBUTES_SIZE> {
        self.kernel.get_synapse_attributes(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        self.kernel.get_synapse_attribute(slot, attribute_offset)
    }

    pub fn set_synapse_attributes(&'_ self, slot: usize, data: SynapseAttributes) {
        self.kernel.set_synapse_attributes(slot, data)
    }

    pub fn set_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        self.kernel
            .set_synapse_attribute(slot, attribute_offset, value)
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        kind: i32,
    ) -> Result<usize, KernelError> {
        self.kernel.connect(source_slot, target_slot, kind)
    }

    pub fn disconnect(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.kernel.disconnect(slot)
    }
}
