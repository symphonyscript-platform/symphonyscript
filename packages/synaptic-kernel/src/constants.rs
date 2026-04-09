/// "SYCT" in ASCII - identifies valid ControlPlane in memory.
pub const CONTROLLER_MAGIC: u32 = 0x53594354;

/// "SYGR" in ASCII - identifies valid SynapticGraph in memory.
pub const GRAPH_MAGIC: i32 = 0x53594752;

/// Kernel binary protocol version. Checked on `bind()` to reject version mismatches.
pub const KERNEL_VERSION: i32 = 0x01;

/// Fixed structural slot width for graph node (i32 count, including 1 reserved)
pub const NODE_SIZE: usize = 8;

/// Fixed structural slot width for graph synapse (i32 count, including 1 reserved)
pub const SYNAPSE_SIZE: usize = 8;
