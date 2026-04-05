use crate::constants::CONTROLLER_MAGIC;
use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;

pub struct KernelProcessor<
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
>
KernelProcessor<
    NODE_META_SIZE,
    NODE_ATTRIBUTES_SIZE,
    SYNAPSE_META_SIZE,
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
                NODE_META_SIZE,
                NODE_ATTRIBUTES_SIZE,
                SYNAPSE_META_SIZE,
                SYNAPSE_ATTRIBUTES_SIZE,
            >,
        }
    }

    pub fn acquire_graph(
        &mut self,
    ) -> (&SynapticGraphReader<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >, i32) {
        let control_plane = unsafe { &*self.control_plane_ptr };
        let graph_ptr = control_plane.get_shared_graph_ptr();
        let graph = unsafe { &mut *graph_ptr };
        let writer_generation = control_plane.get_writer_generation();

        graph.swap();

        (graph, writer_generation)
    }

    pub fn ack(&self, generation: i32) {
        let control_plane = unsafe { &*self.control_plane_ptr };
        control_plane.ack(generation);
    }

    pub fn process(&mut self) {
        let control_plane_ptr = self.control_plane_ptr;
        let (_graph, writer_generation) = self.acquire_graph();
        // traverse

        let control_plane = unsafe { &*control_plane_ptr };
        control_plane.ack(writer_generation);
    }
}
