use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicI32, AtomicPtr, Ordering};

/// Lock-free control plane for initial delivery and later hot-swapping of
/// the active graph.
///
/// Owns the current `Box<SynapticGraphReader>` and provides atomic access to it.
///
/// Acts as the sole source of truth for which graph instance the consumer thread should traverse.
///
/// Acts as the sole source of truth indicating which `SynapticGraphReader` instance the
/// consumer thread should traverse. Orchestrates the safe delivery of the initial graph, as well
/// as hot-swapping to new graph instances when the kernel reallocates due to `grow()`.
///
/// Additionally, provides a stable, `#[repr(C)]` memory layout for exposing the kernel to FFI.
///
/// # Mechanism
/// The kernel initializes this with a `Box<SynapticGraphReader>` via `new()`.
/// When `grow()` occurs, the kernel calls `set_graph()` with the new reader.
/// `set_graph()` atomically swaps the internal pointer
/// and returns the old `Box<SynapticGraphReader>` for deferred deletion.
/// The kernel stamps the old reader with the next generation, holds the (old_reader, gen)
/// in a deletion queue until the consumer has acknowledged the new generation via `ack()`,
/// ensuring the old memory is never freed while the consumer is still traversing it.
///
/// # Threading
/// Wait-free SPSC synchronization.
/// - `set_graph()` / `get_graph()`: `Acquire`/`Release` on the internal `AtomicPtr`.
/// - `inc_writer_generation()`: `Relaxed` (called only by producer thread).
/// - `get_reader_ack_generation()`: `Acquire` (synchronizes against
///   consumer's `Release` in `ack()`).
///
/// # Constraints
/// - `get_graph()` / `ack()`: Consumer thread only.
/// - `set_graph()` / `inc_writer_generation()`: Producer thread only.
/// - `get_reader_ack_generation()`: Producer thread only (Reads consumer's ack).
#[repr(C)]
pub struct ControlPlane<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
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
        synaptic_graph_reader: Box<
            SynapticGraphReader<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    ) -> Self {
        ControlPlane {
            shared_graph_ptr: AtomicPtr::new(Box::into_raw(synaptic_graph_reader)),
            writer_generation: AtomicI32::new(1),
            reader_ack_generation: AtomicI32::new(0),
        }
    }

    pub fn get_graph(
        &self,
    ) -> &SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        let graph_ptr = self.shared_graph_ptr.load(Ordering::Acquire);

        // SAFETY: The point    er is always valid, because it's managed by Kernel's Box lifecycle
        // and generation-gated deferred deletion.
        unsafe { &*graph_ptr }
    }

    pub fn set_graph(
        &self,
        synaptic_graph_reader: Box<
            SynapticGraphReader<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    ) -> Box<
        SynapticGraphReader<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    > {
        let new_graph_ptr = Box::into_raw(synaptic_graph_reader);
        let old_graph_ptr = self.shared_graph_ptr.swap(new_graph_ptr, Ordering::AcqRel);

        // SAFETY: old_graph_ptr was originally created by Box::into_raw() in a prior
        // set_graph() or ControlPlane::new(). The atomic swap guarantees exclusive access -
        // no other thread holds this pointer after the swap().
        unsafe { Box::from_raw(old_graph_ptr) }
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
