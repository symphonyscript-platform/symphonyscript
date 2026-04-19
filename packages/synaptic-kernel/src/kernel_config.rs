/// Configuration for memory sizing of a Kernel.
///
/// Defines the capacities and metadata sizes used to pre-compute the required memory pool
/// sizes ahead of initialization.
///
/// # Fields
/// - `node_capacity`: Maximum number of graph nodes.
/// - `synapse_capacity`: Maximum number of graph synapses (connections).
/// - `mem_metadata_size`: Power-of-2 size of the global metadata region residing
///    on the `mem` (direct) plane.
/// - `tb_metadata_size`: Power-of-2 size of the global metadata region residing
///    on the `tb` (triple-buffer) plane.
#[derive(Clone)]
pub struct KernelConfig {
    pub node_capacity: usize,
    pub synapse_capacity: usize,
    pub mem_metadata_size: usize,
    pub tb_metadata_size: usize,
}
