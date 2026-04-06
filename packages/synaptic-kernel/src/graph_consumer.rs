use crate::constants::CONTROLLER_MAGIC;
use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;

pub struct GraphConsumer<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    control_plane_ptr: *const ControlPlane<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> GraphConsumer<NODE_META_SIZE, NODE_ATTRIBUTES_SIZE, SYNAPSE_META_SIZE, SYNAPSE_ATTRIBUTES_SIZE>
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
                    NODE_META_SIZE,
                    NODE_ATTRIBUTES_SIZE,
                    SYNAPSE_META_SIZE,
                    SYNAPSE_ATTRIBUTES_SIZE,
                >,
        }
    }

    pub fn acquire_graph(
        &mut self,
    ) -> &SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        let control_plane = unsafe { &*self.control_plane_ptr };
        let graph_ptr = control_plane.get_shared_graph_ptr();
        let graph = unsafe { &mut *graph_ptr };
        let writer_generation = control_plane.get_writer_generation();

        control_plane.ack(writer_generation - 1);
        graph.swap();

        graph
    }
}
