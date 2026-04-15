use crate::constants::{
    NODE_ATTRIBUTES_SIZE, NODE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE,
};
use std::sync::Arc;
use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::serialized_kernel::SerializedKernel;
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;

pub type SymphonyEngineKernel =
    Kernel<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>;
pub type SymphonyEngineControlPlane =
    ControlPlane<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>;

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
}
