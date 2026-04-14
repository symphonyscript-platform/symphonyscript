use crate::synaptic_graph_config::SynapticGraphConfig;

#[derive(Clone)]
pub struct SerializedKernel {
    pub config: SynapticGraphConfig,
    pub mem: Vec<i32>,
}
