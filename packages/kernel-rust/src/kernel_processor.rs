use crate::constants::CONTROLLER_MAGIC;
use crate::control_plane::ControlPlane;
use crate::synaptic_graph_reader::SynapticGraphReader;

pub struct KernelProcessor {
    control_plane_ptr: *const ControlPlane,
}

impl KernelProcessor {
    pub fn new(control_plane_address: usize) -> Self {
        let signature = unsafe { std::ptr::read(control_plane_address as *const u32) };

        if signature != CONTROLLER_MAGIC {
            panic!("invalid control_plane_address provided to the KernelProcessor")
        }

        KernelProcessor {
            control_plane_ptr: control_plane_address as *const ControlPlane,
        }
    }

    pub fn acquire_graph(&mut self) -> &SynapticGraphReader {
        let control_plane = unsafe { &*self.control_plane_ptr };
        let graph_ptr = control_plane.get_shared_graph_ptr();
        let mut graph = unsafe { &mut *graph_ptr };

        graph.swap();

        graph
    }

    pub fn process() {

    }
}
