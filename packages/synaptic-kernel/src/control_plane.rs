use crate::constants::CONTROLLER_MAGIC;
use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicI32, AtomicPtr, Ordering};

/// Lock-free control plane for initial delivery and later hot-swapping of
/// the active graph.
///
/// Acts as the sole source of truth indicating which `SynapticGraphReader` instance the
/// consumer thread should traverse. Orchestrates the safe delivery of the initial graph, as well
/// as hot-swapping to new graph instances when the kernel reallocates due to `grow()`.
///
/// Additionally, provides a stable, `#[repr(C)]` memory layout for exposing the kernel to FFI.
///
/// # Mechanism
/// The host initializes this with a valid graph pointer. When `grow()` occurs, the host stores
/// the new pointer and increments `writer_generation`. The consumer thread detects this change,
/// adopts the new points, and writes back to `reader_ack_generation`.
/// This cyclic acknowledgement ensures the writer never drops the old memory while the consumer
/// is still traversing it.
///
/// # Threading
/// Wait-free SPSC synchronization.
/// - Pointer exchange uses `Acquire`/`Release` ordering.
/// - Generation sync uses `Acquire` on read, `Release` on ack.
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
            writer_generation: AtomicI32::new(1),
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

    pub fn ack(&self) {
        let writer_generation = self.get_writer_generation();
        self.reader_ack_generation
            .store(writer_generation - 1, Ordering::Release)
    }
}
