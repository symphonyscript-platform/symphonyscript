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
/// - Created by passing `&ControlPlane` to `new()`.
pub struct GraphConsumer<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    control_plane: Arc<
        ControlPlane<
            NODE_META_SIZE,
            NODE_ATTRIBUTES_SIZE,
            SYNAPSE_META_SIZE,
            SYNAPSE_ATTRIBUTES_SIZE,
        >,
    >,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> GraphConsumer<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>
{
    pub fn new(
        control_plane: Arc<
            ControlPlane<
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        >,
    ) -> Self {
        GraphConsumer { control_plane }
    }

    pub fn acquire_graph(
        &self,
    ) -> &SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        let graph = self.control_plane.acquire_graph();

        graph.swap();

        graph
    }
}
