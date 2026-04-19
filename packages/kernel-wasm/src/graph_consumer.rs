use crate::constants::CONTROLLER_MAGIC;
use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;

/// Provides consumer side entry point to the graph reader.
///
/// Binds to the `ControlPlane` via a raw memory address and provides access
/// to the most recent graph reader.
///
/// # Threading
/// Consumer thread only.
///
/// # Usage
/// Call `acquire_graph()` at the start of every processing cycle.
/// It:
/// 1. Retrieves the currently active graph pointer from the `ControlPlane`.
/// 2. Calls `swap()` to apply any pending triple-buffer updates.
/// 3. Calls `ack()` to signal the safe release of any older graph instances,
///    allowing the producer to safely free their memory.
/// 4. Returns the ready-to-read `SynapticGraphReader`.
pub struct GraphConsumer<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    control_plane_ptr: *const ControlPlane<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> GraphConsumer<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>
{
    pub fn bind(control_plane_address: usize) -> Self {
        let signature = unsafe { std::ptr::read(control_plane_address as *const u32) };

        if signature != CONTROLLER_MAGIC {
            panic!(
                "GraphConsumer::new | invalid control_plane_address provided to the GraphConsumer"
            )
        }

        GraphConsumer {
            control_plane_ptr: control_plane_address
                as *const ControlPlane<
                    NODE_META_STRIDE,
                    NODE_ATTRIBUTES_STRIDE,
                    SYNAPSE_META_STRIDE,
                    SYNAPSE_ATTRIBUTES_STRIDE,
                >,
        }
    }

    pub fn acquire_graph(
        &mut self,
    ) -> &SynapticGraphReader<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    > {
        let control_plane = unsafe { &*self.control_plane_ptr };
        let graph_ptr = control_plane.get_shared_graph_ptr();
        let graph = unsafe { &mut *graph_ptr };

        graph.swap();
        control_plane.ack();

        graph
    }
}
