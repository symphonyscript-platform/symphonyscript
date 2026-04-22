use crate::primitives::entry_store_def::EntryStoreDef;
use crate::primitives::triple_buffer_def::TripleBufferDef;

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
/// - `tb_defs`: Definitions for `TB_COUNT` user-allocated triple-buffers.
///   IDs must form a permutation of `[0, TB_COUNT-1]`.
///   The kernel-internal default TB is managed separately and is not to be included
///   in this array.
/// - `store_defs`: Definitions for `STORE_COUNT` user-allocated entity stores.
///   IDs must form a permutation of `[0, STORE_COUNT-1]`.
#[derive(Clone)]
pub struct KernelConfig<const TB_COUNT: usize, const STORE_COUNT: usize> {
    pub node_capacity: usize,
    pub synapse_capacity: usize,
    pub mem_metadata_size: usize,
    pub tb_defs: [TripleBufferDef; TB_COUNT],
    pub store_defs: [EntryStoreDef; STORE_COUNT],
}
