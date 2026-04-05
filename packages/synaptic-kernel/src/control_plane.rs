use crate::constants::CONTROLLER_MAGIC;
use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicPtr, Ordering};

#[repr(C)]
pub struct ControlPlane<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    signature: u32,
    shared_graph_ptr: AtomicPtr<
        SynapticGraphReader<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
}

impl<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> ControlPlane<NODE_FRAME_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_FRAME_SIZE, SYNAPSE_ATTRIBUTES_SIZE>
{
    pub fn new(
        shared_graph_ptr: *mut SynapticGraphReader<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    ) -> Self {
        ControlPlane {
            signature: CONTROLLER_MAGIC,
            shared_graph_ptr: AtomicPtr::new(shared_graph_ptr),
        }
    }

    pub fn get_shared_graph_ptr(
        &self,
    ) -> *mut SynapticGraphReader<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        self.shared_graph_ptr.load(Ordering::Acquire)
    }

    pub fn set_shared_graph_ptr(
        &self,
        ptr: *mut SynapticGraphReader<
            NODE_FRAME_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_FRAME_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    ) {
        self.shared_graph_ptr.store(ptr, Ordering::Release)
    }
}
