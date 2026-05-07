use crate::constants::{
    SerializedSymphonyEngine, SymphonyEngineConfig, SymphonyEngineControlPlane, SymphonyEngineKernel, SE_LUT_COUNT,
    SE_STORE_COUNT, SE_TB_COUNT,
};
use std::sync::Arc;
use synaptic_kernel::errors::kernel_error::KernelError;
use synaptic_kernel::primitives::entry_store_def::EntryStoreId;
use synaptic_kernel::primitives::entry_store_writer::EntryStoreWriter;
use synaptic_kernel::primitives::lut_def::LutId;
use synaptic_kernel::primitives::lut_writer::LutWriter;
use synaptic_kernel::primitives::tb_writer::TbWriter;
use synaptic_kernel::primitives::triple_buffer_def::TripleBufferId;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::serialized_kernel::SerializedKernel;

pub struct SymphonyEngine {
    pub(crate) kernel: SymphonyEngineKernel,
}

impl SymphonyEngine {
    pub fn new(config: SymphonyEngineConfig) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::new(config),
        }
    }

    pub fn new_from_mem(mem: AtomicBuffer, config: SymphonyEngineConfig) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::new_from_mem(mem, config),
        }
    }

    pub fn load_serialized(
        serialized_kernel: SerializedKernel<SE_TB_COUNT, SE_STORE_COUNT, SE_LUT_COUNT>,
    ) -> Self {
        SymphonyEngine {
            kernel: SymphonyEngineKernel::load_serialized(serialized_kernel),
        }
    }

    pub fn serialize(&mut self) -> SerializedSymphonyEngine {
        self.kernel.serialize()
    }

    pub fn get_control_plane(&self) -> Arc<SymphonyEngineControlPlane> {
        self.kernel.get_control_plane()
    }

    #[inline]
    pub fn node_capacity(&self) -> usize {
        self.kernel.node_capacity()
    }

    #[inline]
    pub fn node_count(&self) -> usize {
        self.kernel.node_count()
    }

    #[inline]
    pub fn node_utilization(&self) -> f32 {
        self.kernel.node_utilization()
    }

    #[inline]
    pub fn synapse_capacity(&self) -> usize {
        self.kernel.synapse_capacity()
    }

    #[inline]
    pub fn synapse_count(&self) -> usize {
        self.kernel.synapse_count()
    }

    #[inline]
    pub fn synapse_utilization(&self) -> f32 {
        self.kernel.synapse_utilization()
    }

    #[inline]
    pub fn peek_utilization(&self) -> f32 {
        self.kernel.peek_utilization()
    }

    #[inline]
    pub fn get_user_tb(&'_ self, tb_id: TripleBufferId) -> TbWriter<'_> {
        self.kernel.get_user_tb(tb_id)
    }

    #[inline]
    pub fn get_entry_store(&self, store_id: EntryStoreId) -> &EntryStoreWriter {
        self.kernel.get_entry_store(store_id)
    }

    #[inline]
    pub fn get_lut(&self, lut_id: LutId) -> &LutWriter {
        self.kernel.get_lut(lut_id)
    }

    pub fn publish(&mut self) {
        self.kernel.publish()
    }

    pub fn should_grow(&self, target_resize_threshold: f32) -> bool {
        self.kernel.should_grow(target_resize_threshold)
    }

    pub fn grow(&mut self, config: SymphonyEngineConfig) -> Result<(), KernelError> {
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
