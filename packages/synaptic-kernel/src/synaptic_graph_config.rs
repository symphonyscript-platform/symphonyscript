#[derive(Clone)]
pub struct SynapticGraphConfig {
    pub node_capacity: usize,
    pub synapse_capacity: usize,
    pub mem_metadata_size: usize,
    pub tb_metadata_size: usize,
}