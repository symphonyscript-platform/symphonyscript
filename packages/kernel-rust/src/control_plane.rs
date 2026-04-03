use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicPtr, Ordering};
use crate::constants::CONTROLLER_MAGIC;

#[repr(C)]
pub struct ControlPlane {
    signature: u32,
    shared_graph_ptr: AtomicPtr<SynapticGraphReader>,
}

impl ControlPlane {
    pub fn new(shared_graph_ptr: *mut SynapticGraphReader) -> Self {
        ControlPlane {
            signature: CONTROLLER_MAGIC,
            shared_graph_ptr: AtomicPtr::new(shared_graph_ptr),
        }
    }

    pub fn get_shared_graph_ptr(&self) -> *mut SynapticGraphReader {
        self.shared_graph_ptr.load(Ordering::Acquire)
    }

    pub fn set_shared_graph_ptr(&self, ptr: *mut SynapticGraphReader) {
        self.shared_graph_ptr.store(ptr, Ordering::Release)
    }
}
