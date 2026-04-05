use crate::constants::CONTROLLER_MAGIC;
use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicI32, AtomicPtr, Ordering};

#[repr(C)]
pub struct ControlPlane<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    signature: u32,
    shared_graph_ptr: AtomicPtr<
        SynapticGraphReader<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
    writer_generation: AtomicI32,
    reader_ack_generation: AtomicI32,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> ControlPlane<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>
{
    pub fn new(
        shared_graph_ptr: *mut SynapticGraphReader<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    ) -> Self {
        ControlPlane {
            signature: CONTROLLER_MAGIC,
            shared_graph_ptr: AtomicPtr::new(shared_graph_ptr),
            writer_generation: AtomicI32::new(0),
            reader_ack_generation: AtomicI32::new(0),
        }
    }

    pub fn get_shared_graph_ptr(
        &self,
    ) -> *mut SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        self.shared_graph_ptr.load(Ordering::Acquire)
    }

    pub fn set_shared_graph_ptr(
        &self,
        ptr: *mut SynapticGraphReader<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    ) {
        self.shared_graph_ptr.store(ptr, Ordering::Release)
    }

    pub fn get_writer_generation(&self) -> i32 {
        self.writer_generation.load(Ordering::Relaxed)
    }

    pub fn inc_writer_generation(&self) -> i32 {
        self.writer_generation.fetch_add(1, Ordering::Relaxed)
    }

    pub fn get_reader_ack_generation(&self) -> i32 {
        self.reader_ack_generation.load(Ordering::Acquire)
    }

    pub fn ack(&self, writer_generation: i32) {
        self.reader_ack_generation
            .store(writer_generation, Ordering::Release)
    }
}
