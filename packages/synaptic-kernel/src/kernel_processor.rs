use crate::constants::CONTROLLER_MAGIC;
use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;

pub struct KernelProcessor<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    control_plane_ptr: *const ControlPlane<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >,
}

impl<
    const NODE_FRAME_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_FRAME_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
>
    KernelProcessor<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >
{
    pub fn new(control_plane_address: usize) -> Self {
        let signature = unsafe { std::ptr::read(control_plane_address as *const u32) };

        if signature != CONTROLLER_MAGIC {
            panic!("invalid control_plane_address provided to the KernelProcessor")
        }

        KernelProcessor {
            control_plane_ptr: control_plane_address
                as *const ControlPlane<
                    NODE_FRAME_SIZE,
                    NODE_ATTRIBUTES_SIZE,
                    SYNAPSE_FRAME_SIZE,
                    SYNAPSE_ATTRIBUTES_SIZE,
                >,
        }
    }

    pub fn acquire_graph(
        &mut self,
    ) -> &SynapticGraphReader<
        NODE_FRAME_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_FRAME_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    > {
        let control_plane = unsafe { &*self.control_plane_ptr };
        let graph_ptr = control_plane.get_shared_graph_ptr();
        let graph = unsafe { &mut *graph_ptr };

        graph.swap();

        graph
    }

    pub fn process() {}
}
