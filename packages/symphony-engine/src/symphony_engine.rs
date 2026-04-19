use crate::constants::{
    NODE_ATTRIBUTES_STRIDE, NODE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE,
};
use std::sync::Arc;
use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::errors::kernel_error::KernelError;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::serialized_kernel::SerializedKernel;
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;

pub type SymphonyEngineKernel =
    Kernel<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>;
pub type SymphonyEngineControlPlane =
    ControlPlane<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>;

pub struct SymphonyEngine {
    pub(crate) kernel: SymphonyEngineKernel,
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
    pub fn get_control_plane(&self) -> Arc<SymphonyEngineControlPlane> {
        self.kernel.get_control_plane()
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

    pub fn publish(&mut self) {
        self.kernel.publish()
    }

    pub fn should_grow(&self, target_resize_threshold: f32) -> bool {
        self.kernel.should_grow(target_resize_threshold)
    }

    pub fn grow(&mut self, config: SynapticGraphConfig) -> Result<(), KernelError> {
        self.kernel.grow(config)
    }

    /// Returns a reference to the underlying kernel.
    /// Escape hatch for operations not covered by the engine's domain API.
    ///
    /// # Safety Contract
    /// The caller assumes full responsibility for maintaining kernel invariants.
    /// Intended exclusively for read-only telemetry and debugging.
    pub fn get_kernel(&self) -> &SymphonyEngineKernel {
        &self.kernel
    }
}
