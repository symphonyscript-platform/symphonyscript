use crate::constants::{KERNEL_MAGIC, KERNEL_VERSION};
use crate::control_plane::ControlPlane;
use crate::epoch::Epoch;
use crate::epoch_mirror::EpochMirror;
use crate::errors::kernel_error::KernelError;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::kernel_config::KernelConfig;
use crate::primitives::types::AtomicBuffer;
use crate::serialized_kernel::SerializedKernel;
use crate::topology::network::synapse_view::SynapseView;
use crate::topology::node::node_view::NodeView;
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
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    config: KernelConfig,
    mem: AtomicBuffer,
    control_plane: Arc<
        ControlPlane<
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >,
    >,
    active_epoch: Epoch<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >,
    readers_pending_deletion: VecDeque<(
        Box<
            EpochMirror<
                NODE_META_STRIDE,
                NODE_ATTRIBUTES_STRIDE,
                SYNAPSE_META_STRIDE,
                SYNAPSE_ATTRIBUTES_STRIDE,
            >,
        >,
        i32,
    )>,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> Kernel<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>
{
    pub const HEADERS_SIZE: usize = 2;

    pub fn new(config: KernelConfig) -> Self {
        let mem = Self::create_mem(Epoch::<
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >::calculate_size_on_mem(&config));
        Self::new_from_mem(mem, config)
    }

    pub fn new_from_mem(mem: AtomicBuffer, config: KernelConfig) -> Self {
        let epoch = Epoch::new(Arc::clone(&mem), config.clone());
        let mirror = Box::new(epoch.to_reader());
        let control_plane = Arc::new(ControlPlane::new(mirror));

        assert!(
            mem[0].load(Ordering::Acquire) == 0 && mem[1].load(Ordering::Acquire) == 0,
            "Attempted to initialize SynapticGraphWriter on already allocated memory"
        );

        assert!(
            mem.len() >= Epoch::calculate_size_on_mem(&config),
            "Provided AtomicBuffer is too small for this configuration"
        );

        mem[0].store(KERNEL_MAGIC, Ordering::Release);
        mem[1].store(KERNEL_VERSION, Ordering::Release);

        Kernel {
            config,
            mem,
            control_plane,
            active_epoch: epoch,
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

        assert_eq!(
            mem[0].load(Ordering::Acquire),
            KERNEL_MAGIC,
            "Attempted to initialize Kernel on foreign memory"
        );
        assert_eq!(
            mem[1].load(Ordering::Acquire),
            KERNEL_VERSION,
            "Attempted to initialize Kernel on mismatched AtomicBuffer version"
        );

        assert!(
            mem.len() >= Epoch::calculate_size_on_mem(&config),
            "Provided AtomicBuffer is too small for this configuration"
        );

        let writer = Epoch::bind(Arc::clone(&mem), config.clone());
        let reader = Box::new(writer.to_reader());
        let control_plane = Arc::new(ControlPlane::new(reader));

        Kernel {
            config,
            mem,
            control_plane,
            active_epoch: writer,
            readers_pending_deletion: VecDeque::new(),
        }
    }

    /// Snapshots the current kernel state for persistence.
    ///
    /// # Safety Contract
    /// The consumer thread **must** be fully quiesced before calling `serialize`.
    /// If a consumer thread is actively traversing the graph or acking generations,
    /// the snapshot may capture a torn SPSC state (e.g., a triple buffer mid-swap).
    /// This is the same quiescence requirement that applies to dropping the Kernel.
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
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >,
    > {
        Arc::clone(&self.control_plane)
    }

    #[inline]
    pub fn mem_metadata_capacity(&self) -> usize {
        self.active_epoch.mem_metadata.capacity()
    }

    #[inline]
    pub fn tb_metadata_capacity(&self) -> usize {
        self.active_epoch.tb_metadata.capacity()
    }

    #[inline]
    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.active_epoch.mem_metadata.read(offset)
    }

    #[inline]
    pub fn mem_write_meta(&self, offset: usize, value: i32) {
        self.active_epoch.mem_metadata.write(offset, value);
    }

    #[inline]
    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.active_epoch.tb_metadata.read(offset)
    }

    #[inline]
    pub fn tb_write_meta(&self, offset: usize, value: i32) {
        self.active_epoch.tb_metadata.write(offset, value);
    }

    #[inline]
    pub fn node_capacity(&self) -> usize {
        self.active_epoch.network.node_capacity()
    }

    #[inline]
    pub fn node_count(&self) -> usize {
        self.active_epoch.network.node_count()
    }

    #[inline]
    pub fn node_utilization(&self) -> f32 {
        self.active_epoch.network.node_utilization()
    }

    #[inline]
    pub fn synapse_capacity(&self) -> usize {
        self.active_epoch.network.synapse_capacity()
    }

    #[inline]
    pub fn synapse_count(&self) -> usize {
        self.active_epoch.network.synapse_count()
    }

    #[inline]
    pub fn synapse_utilization(&self) -> f32 {
        self.active_epoch.network.synapse_utilization()
    }

    #[inline]
    pub fn peek_utilization(&self) -> f32 {
        self.active_epoch.network.peek_utilization()
    }

    #[inline]
    pub fn get_head_node(
        &'_ self,
    ) -> Option<NodeView<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>> {
        self.active_epoch.network.get_head_node_view()
    }

    #[inline]
    pub fn get_node(
        &'_ self,
        slot: usize,
    ) -> NodeView<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE> {
        self.active_epoch.network.get_node_view(slot)
    }

    #[inline]
    pub fn get_synapse(
        &'_ self,
        slot: usize,
    ) -> SynapseView<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        self.active_epoch.network.get_synapse_view(slot)
    }

    pub fn insert_head_node(&self, kind: i32) -> Result<usize, KernelError> {
        match self.active_epoch.network.insert_head_node(kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_node_after(&self, prev_slot: usize, kind: i32) -> Result<usize, KernelError> {
        match self.active_epoch.network.insert_node_after(prev_slot, kind) {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn insert_node_before(&self, next_slot: usize, kind: i32) -> Result<usize, KernelError> {
        match self
            .active_epoch
            .network
            .insert_node_before(next_slot, kind)
        {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.active_epoch.network.remove_node(slot)
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        kind: i32,
    ) -> Result<usize, KernelError> {
        match self
            .active_epoch
            .network
            .connect(source_slot, target_slot, kind)
        {
            Some(slot) => Ok(slot),
            None => Err(KernelError::CapacityExhausted),
        }
    }

    pub fn disconnect(&self, source: usize, target: usize) -> Result<(), SlotAllocatorError> {
        self.active_epoch.network.disconnect(source, target)
    }

    pub fn disconnect_synapse(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.active_epoch.network.disconnect_synapse(slot)
    }

    #[inline]
    pub fn should_grow(&self, target_resize_threshold: f32) -> bool {
        self.peek_utilization() > target_resize_threshold
    }

    pub fn publish(&mut self) {
        self.active_epoch.publish();
        let ack = self.control_plane.get_reader_ack_generation();

        while let Some((_, generation)) = self.readers_pending_deletion.front() {
            if (*generation).wrapping_sub(ack) > 0 {
                break;
            }

            self.readers_pending_deletion.pop_front();
        }
    }

    pub fn grow(&mut self, config: KernelConfig) -> Result<(), KernelError> {
        if config.node_capacity < self.node_capacity()
            || config.synapse_capacity < self.synapse_capacity()
        {
            return Err(KernelError::InsufficientCapacity);
        }

        self.mem = Self::create_mem(Epoch::<
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >::calculate_size_on_mem(&config));
        let new_writer = Epoch::new(Arc::clone(&self.mem), config.clone());

        new_writer.copy_from(&self.active_epoch);

        let new_reader = Box::new(new_writer.to_reader());

        self.config = config;
        self.active_epoch = new_writer;
        let old_reader = self.control_plane.swap_graph(new_reader);
        self.readers_pending_deletion.push_back(old_reader);

        Ok(())
    }

    /// Returns a raw handle to the backing `AtomicBuffer`.
    ///
    /// # Safety Contract
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
