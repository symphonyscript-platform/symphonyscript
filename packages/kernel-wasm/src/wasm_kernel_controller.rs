use symphonyscript_kernel::constants::{NODE_ATTRIBUTES_SLOT_SIZE, NODE_SIZE};
use symphonyscript_kernel::kernel_controller::KernelController;
use symphonyscript_kernel::synaptic_graph_config::SynapticGraphConfig;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmKernelController {
    pub(crate) kernel: KernelController,
}

#[wasm_bindgen]
impl WasmKernelController {
    #[wasm_bindgen(constructor)]
    pub fn new(node_capacity: usize, synapse_capacity: usize) -> Self {
        let config = SynapticGraphConfig {
            node_capacity,
            synapse_capacity,
        };

        WasmKernelController {
            kernel: KernelController::new(config),
        }
    }

    #[wasm_bindgen]
    pub fn get_controller_plane_address(&self) -> usize {
        self.kernel.get_controller_plane_address()
    }

    #[wasm_bindgen]
    pub fn node_capacity(&self) -> usize {
        self.kernel.node_capacity()
    }

    #[wasm_bindgen]
    pub fn node_count(&self) -> usize {
        self.kernel.node_count()
    }

    #[wasm_bindgen]
    pub fn node_utilization(&self) -> f32 {
        self.kernel.node_utilization()
    }

    #[wasm_bindgen]
    pub fn synapse_capacity(&self) -> usize {
        self.kernel.synapse_capacity()
    }

    #[wasm_bindgen]
    pub fn synapse_count(&self) -> usize {
        self.kernel.synapse_count()
    }

    #[wasm_bindgen]
    pub fn synapse_utilization(&self) -> f32 {
        self.kernel.synapse_utilization()
    }

    #[wasm_bindgen]
    pub fn peek_utilization(&self) -> f32 {
        self.kernel.peek_utilization()
    }

    #[wasm_bindgen]
    pub fn get_head_node_slot(&self) -> usize {
        self.kernel.get_head_node_slot()
    }

    #[wasm_bindgen]
    pub fn get_node(&self, slot: usize, output: &mut [i32]) -> bool {
        assert!(
            output.len() >= NODE_SIZE,
            "WasmKernelController.get_node | output buffer length must be at least {}",
            NODE_SIZE
        );

        let node = self.kernel.get_node(slot);
        output[0] = node.get_kind();
        output[1] = node.get_base_tick();
        output[2] = node.get_next_ptr() as i32;
        output[3] = node.get_prev_ptr() as i32;
        output[4] = node.get_outgoing_synapse_head() as i32;
        output[5] = node.get_outgoing_synapse_tail() as i32;
        output[6] = node.get_incoming_synapse_head() as i32;
        output[7] = node.get_incoming_synapse_tail() as i32;
        output[8] = node.get_mod_head() as i32;

        true
    }

    pub fn get_node_attributes(&self, slot: usize, output: &mut [i32]) -> bool {
        assert!(
            output.len() >= NODE_ATTRIBUTES_SLOT_SIZE,
            "WasmKernelController.get_node | output buffer length must be at least {}",
            NODE_ATTRIBUTES_SLOT_SIZE
        );

        let attributes = self.kernel.get_node_attributes(slot);

        for i in 0..16 {
            output[i] = attributes.read(i);
        }

        true
    }
}
