use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::atomic::{AtomicI32, AtomicPtr, Ordering};

/// Lock-free control plane for initial delivery and later hot-swapping of
/// the active graph.
///
/// Owns the current `Box<SynapticGraphReader>` and provides atomic access to it.
/// Acts as the sole source of truth indicating which `SynapticGraphReader` instance the
/// consumer thread should traverse. Orchestrates the safe delivery of the initial graph, as well
/// as hot-swapping to new graph instances when the kernel reallocates due to `grow()`.
///
/// # Mechanism
/// The kernel initializes this with a `Box<SynapticGraphReader>` via `new()`.
/// When `grow()` occurs, the kernel calls `swap_graph()` with the new reader.
/// `swap_graph()` atomically swaps the internal pointer, advances the writer generation,
/// and returns the old `(old_reader, deletion_gen)` - the old reader paired with its
/// generation stamp for deferred deletion.
/// The kernel holds the pair in a deletion queue and frees it only once the consumer's
/// acknowledged generation reaches the stamp.
///
/// On the consumer side, `acquire_graph()` acknowledges the current generation **before**
/// loading the graph pointer, ensuring the consumer's ack never exceeds the generation
/// of the graph it actually receives.
///
/// # Threading
/// Wait-free SPSC synchronization.
/// - `swap_graph()`: `AcqRel` on the `AtomicPtr` swap; `Release` on the writer generation
///   increment (producer-only, follows the `swap()`).
/// - `acquire_graph()`: `Release` on the ack store; `Acquire` on the `AtomicPtr` load.
///   The internal writer generation read uses `Acquire`; A stale value yields a
///   conservative (lower) ack, never premature freeing.
/// - `get_reader_ack_generation()`: `Acquire` (synchronizes against
///   consumer's `Release` in `acquire_graph()`).
///
/// # Constraints
/// - `acquire_graph()`: Consumer thread only.
/// - `swap_graph()`: Producer thread only.
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
            writer_generation: AtomicI32::new(0),
            reader_ack_generation: AtomicI32::new(0),
        }
    }

    pub fn acquire_graph(
        &self,
    ) -> &SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        self.ack();

        let graph_ptr = self.shared_graph_ptr.load(Ordering::Acquire);

        // SAFETY: The pointer is always valid, because it's managed by Kernel's Box lifecycle
        // and generation-gated deferred deletion.
        unsafe { &*graph_ptr }
    }

    pub fn swap_graph(
        &self,
        new_graph: Box<
            SynapticGraphReader<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    ) -> (
        Box<
            SynapticGraphReader<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
        i32,
    ) {
        let new_graph_ptr = Box::into_raw(new_graph);
        let old_graph_ptr = self.shared_graph_ptr.swap(new_graph_ptr, Ordering::AcqRel);
        let prev_gen = self.writer_generation.fetch_add(1, Ordering::Release);

        // SAFETY: old_graph_ptr was originally created by Box::into_raw() in a prior
        // swap_graph() or ControlPlane::new(). The atomic swap guarantees exclusive access -
        // no other thread holds this graph after the swap().
        let old_graph = unsafe { Box::from_raw(old_graph_ptr) };

        (old_graph, prev_gen + 1)
    }

    pub fn get_reader_ack_generation(&self) -> i32 {
        self.reader_ack_generation.load(Ordering::Acquire)
    }

    fn ack(&self) {
        let writer_generation = self.writer_generation.load(Ordering::Acquire);
        self.reader_ack_generation
            .store(writer_generation, Ordering::Release)
    }
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> Drop
    for ControlPlane<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >
{
    fn drop(&mut self) {
        // SAFETY: The pointer was created by Box::into_raw() in a prior
        // swap_graph() or ControlPlane::new(). `&mut self` guarantees exclusive access.
        // No concurrent load is possible.
        unsafe {
            drop(Box::from_raw(self.shared_graph_ptr.load(Ordering::Relaxed)));
        }
    }
}
