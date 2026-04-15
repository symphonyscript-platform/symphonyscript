use crate::attributes::attributes_writer::AttributesWriter;
use crate::control_plane::ControlPlane;
use crate::errors::kernel_error::KernelError;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::AtomicBuffer;
use crate::serialized_kernel::SerializedKernel;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::synaptic_graph_reader::SynapticGraphReader;
use crate::synaptic_graph_writer::SynapticGraphWriter;
use crate::topology::node::node_writer::NodeWriter;
use crate::topology::synapse::synapse_writer::SynapseWriter;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;

/// Producer-side entry point to the synaptic graph.
///
/// Owns the graph memory, the active graph writer, the control plane, and the
/// deferred-deletion queue.
/// Provides a unified API for building and mutating a lock-free, wait-free SPSC
/// graph topology.
///
/// # Threading
/// Producer thread only. The consumer accesses the graph exclusively through
/// a [`GraphConsumer`] obtained via [`get_control_plane()`].
///
/// # Lifecycle
/// 1. Create via [`new()`] or restore via [`load_serialized()`].
/// 2. Mutate: insert/remove nodes, connect/disconnect synapses, write attributes.
/// 3. Call [`publish()`] to deploy structural changes to the consumer and reclaim
///    generation-acknowledged deferred deletions.
/// 4. Call [`grow()`] when utilization exceeds the target threshold.
///    This allocates a new, larger backing buffer, migrates all state, and
///    hot-swaps the consumer's graph via the [`ControlPlane`].
/// 5. Call [`serialize()`] to a snapshot for persistence.
///
/// # Memory Model
/// - **Structural Changes** (nodes, synapses, topology metadata) are written to the
///   triple-buffered plane and become visible to the consumer after [`publish()`].
/// - **Attributes** (node and synapse) and **mem metadata** are written to the direct
///   plane and are visible to the consumer immediately.
/// - **Deferred deletions** (removed nodes, disconnected synapses) are staged in a
///   generation-gated buffer and reclaimed during [`publish()`] once the consumer has
///   acknowledged the relevant generation.
///
/// # Safety Contract
/// The consumer thread **must** be fully quiesced before the `Kernel` is dropped.
/// Dropping the kernel unconditionally frees the deferred-deletion queue and the backing
/// memory. If the consumer is still traversing a hot-swapped graph, the result
/// is undefined behavior.
pub struct Kernel<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    config: SynapticGraphConfig,
    mem: AtomicBuffer,
    control_plane: Arc<
        ControlPlane<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
    active_writer: SynapticGraphWriter<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >,
    readers_pending_deletion: VecDeque<(
        Box<
            SynapticGraphReader<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
        i32,
    )>,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> Kernel<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>
{
    pub fn new(config: SynapticGraphConfig) -> Self {
        let mem = Self::create_mem(SynapticGraphWriter::<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::calculate_size_on_mem(&config));
        Self::new_from_mem(mem, config)
    }

    pub fn new_from_mem(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        let writer = SynapticGraphWriter::new(Arc::clone(&mem), config.clone());
        let reader = Box::new(writer.to_reader());
        let control_plane = Arc::new(ControlPlane::new(reader));

        Kernel {
            config,
            mem,
            control_plane,
            active_writer: writer,
            readers_pending_deletion: VecDeque::new(),
        }
    }

    pub fn load_serialized(serialized_kernel: SerializedKernel) -> Self {
        let config = serialized_kernel.config;
        let mem: AtomicBuffer = Arc::new(
            serialized_kernel
                .mem
                .into_iter()
                .map(AtomicI32::new)
                .collect(),
        );
        let writer = SynapticGraphWriter::bind(Arc::clone(&mem), config.clone());
        let reader = Box::new(writer.to_reader());
        let control_plane = Arc::new(ControlPlane::new(reader));

        Kernel {
            config,
            mem,
            control_plane,
            active_writer: writer,
            readers_pending_deletion: VecDeque::new(),
        }
    }

    pub fn serialize(&mut self) -> SerializedKernel {
        self.publish();

        let mem = self.mem.iter().map(|a| a.load(Ordering::Relaxed)).collect();

        SerializedKernel {
            config: self.config.clone(),
            mem,
        }
    }

    /// Returns a shared handle to the `ControlPlane` for constructing a `GraphConsumer` on
    /// the consumer thread.
    ///
    /// The `Arc` is a cross-thread transport mechanism, not a lifetime extension.
    /// The `ControlPlane` has no independent lifecycle - it is logically owned by
    /// this `Kernel`.
    ///
    /// # Safety Contract
    /// The consumer thread **must** be fully quiesced before the `Kernel` is dropped.
    /// Dropping the kernel unconditionally frees the deferred-deletion queue.
    /// If the consumer is still traversing a hot-swapped graph, the result is
    /// undefined behavior.
    pub fn get_control_plane(
        &self,
    ) -> Arc<
        ControlPlane<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    > {
        Arc::clone(&self.control_plane)
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

    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_, NODE_META_SIZE>> {
        self.active_writer.get_head_node()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_, NODE_META_SIZE> {
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

    pub fn insert_head(&self, kind: i32) -> Result<usize, KernelError> {
        match self.active_writer.insert_head(kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_after(&self, prev_slot: usize, kind: i32) -> Result<usize, KernelError> {
        match self.active_writer.insert_after(prev_slot, kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_before(&self, next_slot: usize, kind: i32) -> Result<usize, KernelError> {
        match self.active_writer.insert_before(next_slot, kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.active_writer.remove_node(slot)
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_, SYNAPSE_META_SIZE> {
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
        kind: i32,
    ) -> Result<usize, KernelError> {
        match self.active_writer.connect(source_slot, target_slot, kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn disconnect(&self, source: usize, target: usize) -> Result<(), SlotAllocatorError> {
        self.active_writer.disconnect(source, target)
    }

    pub fn disconnect_synapse(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.active_writer.disconnect_synapse(slot)
    }

    pub fn publish(&mut self) {
        self.active_writer.publish();
        let ack = self.control_plane.get_reader_ack_generation();

        while let Some((_, generation)) = self.readers_pending_deletion.front() {
            if (*generation).wrapping_sub(ack) > 0 {
                break;
            }

            self.readers_pending_deletion.pop_front();
        }
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

        self.mem = Self::create_mem(SynapticGraphWriter::<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >::calculate_size_on_mem(&config));
        let new_writer = SynapticGraphWriter::new(Arc::clone(&self.mem), config.clone());

        new_writer.copy_from(&self.active_writer);

        let new_reader = Box::new(new_writer.to_reader());

        self.config = config;
        self.active_writer = new_writer;
        let old_reader = self.control_plane.swap_graph(new_reader);
        self.readers_pending_deletion.push_back(old_reader);

        Ok(())
    }

    /// Returns a raw handle to the backing `AtomicBuffer`.
    ///
    /// # Safety
    /// The caller assumes full responsibility for memory correctness.
    /// Writing to structural or lifecycle regions will corrupt the graph.
    /// Intended exclusively for read-only telemetry and debugging.
    pub fn get_mem(&self) -> AtomicBuffer {
        Arc::clone(&self.mem)
    }

    fn create_mem(size: usize) -> AtomicBuffer {
        let mem: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();

        Arc::new(mem)
    }
}
