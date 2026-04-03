use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicPtr, Ordering};

pub struct ControlPlane {
    shared_graph_ptr: AtomicPtr<SynapticGraphReader>,
}

impl ControlPlane {
    pub fn new(shared_graph_ptr: *mut SynapticGraphReader) -> Self {
        ControlPlane {
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
