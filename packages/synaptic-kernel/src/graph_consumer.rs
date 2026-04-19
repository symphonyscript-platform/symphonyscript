use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;
use std::sync::Arc;

/// Consumer-side entry point to the graph reader.
///
/// Wraps a `ControlPlane` reference and provides `acquire_graph()`,
/// which combines graph acquisition with triple-buffer consumption into
/// a single call.
///
/// # Threading
/// Consumer thread only.
///
/// # Usage
/// Call `acquire_graph()` at the start of every processing cycle.
/// It:
/// 1. Acquires the current `SynapticGraphReader` from the `ControlPlane` - while also
///    internally acknowledging the current generation before loading the pointer.
/// 2. Calls `swap()` to consume any pending triple-buffer updates.
/// 3. Returns the ready-to-read `SynapticGraphReader`.
///
/// The returned reference is valid for the entire cycle - no re-acquisition needed.
///
/// # Constraints
/// - Created by passing `Arc<ControlPlane>` to `new()`.
pub struct GraphConsumer<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    control_plane: Arc<
        ControlPlane<
            NODE_META_STRIDE,
            NODE_ATTRIBUTES_STRIDE,
            SYNAPSE_META_STRIDE,
            SYNAPSE_ATTRIBUTES_STRIDE,
        >,
    >,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> GraphConsumer<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>
{
    pub fn new(
        control_plane: Arc<
            ControlPlane<
                NODE_META_STRIDE,
                NODE_ATTRIBUTES_STRIDE,
                SYNAPSE_META_STRIDE,
                SYNAPSE_ATTRIBUTES_STRIDE,
            >,
        >,
    ) -> Self {
        GraphConsumer { control_plane }
    }

    /// Acquires the current graph for this processing cycle.
    ///
    /// Acknowledges the current generation, loads the graph pointer, and
    /// consumes any pending triple-buffer updates - returning ready-to-read
    /// `SynapticGraphReader`.
    ///
    /// Takes `&mut self` to guarantee at most one live graph reference at a time.
    /// The compiler ensures the previous reference is dropped before the next
    /// acquisition, so the generation acknowledgement always reflects
    /// the consumer's actual state.
    ///
    /// # Usage
    /// Call once at the start of each processing cycle. The returned reference
    /// is valid until the next `acquire_graph()` call.
    pub fn acquire_graph(
        &mut self,
    ) -> &SynapticGraphReader<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    > {
        let graph = self.control_plane.acquire_graph();

        graph.swap();

        graph
    }
}
