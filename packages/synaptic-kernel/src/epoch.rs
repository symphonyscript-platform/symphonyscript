use crate::epoch_mirror::EpochMirror;
use crate::kernel_config::KernelConfig;
use crate::metadata::mem_metadata_writer::MemMetadataWriter;
use crate::metadata::tb_metadata_writer::TbMetadataWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::network::network_writer::NetworkWriter;
use std::sync::Arc;

/// Producer-side graph and topology orchestrator.
///
/// Provides the unified API for mutating the lock-free graph topology and attributes.
/// It encapsulates the underlying memory hierarchy and handles deploying structural updates
/// to the consumer via the `publish()`.
///
/// # Threading
/// Producer thread only.
///
/// # MEM Memory Layout (direct plane)
/// Segments are packed sequentially in a single AtomicBuffer
///
/// ```text
/// Order       Segment             Size
/// -------------------------------------------------------------------------------------------
/// 1           Mem Metadata        MemMetadataWriter::calculate_size_on_mem()
/// 2           Triple Buffer       TripleBufferWriter::calculate_size_on_mem()
/// 3           Network             NetworkWriter::calculate_size_on_mem()
/// ```
///
/// # TB Memory Layout (triple-buffered plane)
/// Segments are packed sequentially within the TripleBufferWriter.
///
/// ```text
/// Order       Segment             Size
/// --------------------------------------------------------------------------
/// 1           Tb Metadata     TbMetadataWriter::calculate_size_on_tb()
/// 2           Network         NetworkWriter::calculate_size_on_tb()
/// ```
///
/// # Deployment
/// 1. Structural updates (e.g. `insert_node`, `connect`) and tb_metadata are written to the active
///    triple-buffer segment.
/// 2. Non-structural updates (e.g. node/synapse attributes) and mem_metadata are written
///    directly to `mem` (direct) plane, making such writes immediately visible to the consumer.
/// 3. `publish()` flushes deferred frees and performs triple-buffer swap, exposing the new state
///   to the consumer.
///
/// # Traits
/// - Memory sizing is defined at compile time via const generics.
/// - Use `to_mirror()` to create the paired `EpochMirror`.
#[derive(Clone)]
pub struct Epoch<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    tb: TripleBufferWriter,

    pub mem_metadata: MemMetadataWriter,
    pub tb_metadata: TbMetadataWriter,
    pub network: NetworkWriter<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> Epoch<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>
{
    pub fn new(mem: AtomicBuffer, config: KernelConfig, mem_start_offset: usize) -> Self {
        Self::create(mem, config, mem_start_offset, false)
    }

    pub fn bind(mem: AtomicBuffer, config: KernelConfig, mem_start_offset: usize) -> Self {
        Self::create(mem, config, mem_start_offset, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        config: KernelConfig,
        mem_start_offset: usize,
        bind: bool,
    ) -> Self {
        let tb_start_offset = 0;

        let mem_metadata = MemMetadataWriter::create(
            Arc::clone(&mem),
            mem_start_offset,
            config.mem_metadata_size,
            bind,
        );
        let tb = TripleBufferWriter::create(
            Arc::clone(&mem),
            mem_metadata.mem_end_offset(),
            Self::calculate_size_on_tb(&config),
            bind,
        );
        let tb_metadata =
            TbMetadataWriter::create(tb.clone(), tb_start_offset, config.tb_metadata_size, bind);
        let network = NetworkWriter::create(
            Arc::clone(&mem),
            tb.clone(),
            tb.mem_end_offset(),
            tb_metadata.tb_end_offset(),
            config.node_capacity,
            config.synapse_capacity,
            bind,
        );

        Epoch {
            tb,
            mem_metadata,
            tb_metadata,
            network,
        }
    }

    pub fn calculate_size_on_mem(config: &KernelConfig) -> usize {
        TripleBufferWriter::calculate_size_on_mem(Self::calculate_size_on_tb(config))
            + MemMetadataWriter::calculate_size_on_mem(config.mem_metadata_size)
            + NetworkWriter::<
                NODE_META_STRIDE,
                NODE_ATTRIBUTES_STRIDE,
                SYNAPSE_META_STRIDE,
                SYNAPSE_ATTRIBUTES_STRIDE,
            >::calculate_size_on_mem(config.node_capacity, config.synapse_capacity)
    }

    pub fn calculate_size_on_tb(config: &KernelConfig) -> usize {
        TbMetadataWriter::calculate_size_on_tb(config.tb_metadata_size)
            + NetworkWriter::<
                NODE_META_STRIDE,
                NODE_ATTRIBUTES_STRIDE,
                SYNAPSE_META_STRIDE,
                SYNAPSE_ATTRIBUTES_STRIDE,
            >::calculate_size_on_tb(config.node_capacity, config.synapse_capacity)
    }

    pub fn to_mirror(
        &self,
    ) -> EpochMirror<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    > {
        EpochMirror::bind(
            self.tb.to_reader(),
            self.mem_metadata.to_reader(),
            self.tb_metadata.to_reader(),
            self.network.to_reader(),
        )
    }

    pub fn publish(&self) {
        self.network.publish();
        self.tb.publish();
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.tb.buffer_capacity() <= self.tb.buffer_capacity(),
            "Epoch.copy_from | source.tb.buffer_capacity() {} cannot be greater than destination.tb.buffer_capacity() {}",
            source.tb.buffer_capacity(),
            self.tb.buffer_capacity(),
        );

        debug_assert!(
            source.mem_metadata.capacity() <= self.mem_metadata.capacity(),
            "MemMetadataWriter.copy_from | source.mem_metadata.capacity() {} cannot be greater than destination.mem_metadata.capacity() {}",
            source.mem_metadata.capacity(),
            self.mem_metadata.capacity(),
        );

        debug_assert!(
            source.tb_metadata.capacity() <= self.tb_metadata.capacity(),
            "MemMetadataWriter.copy_from | source.tb_metadata.capacity() {} cannot be greater than destination.tb_metadata.capacity() {}",
            source.tb_metadata.capacity(),
            self.tb_metadata.capacity(),
        );

        debug_assert!(
            source.network.node_capacity() <= self.network.node_capacity(),
            "MemMetadataWriter.copy_from | source.network.node_capacity() {} cannot be greater than destination.network.node_capacity() {}",
            source.network.node_capacity(),
            self.network.node_capacity(),
        );

        debug_assert!(
            source.network.synapse_capacity() <= self.network.synapse_capacity(),
            "MemMetadataWriter.copy_from | source.network.synapse_capacity() {} cannot be greater than destination.network.synapse_capacity() {}",
            source.network.synapse_capacity(),
            self.network.synapse_capacity(),
        );

        self.tb.copy_metadata_from(&source.tb);
        self.mem_metadata.copy_from(&source.mem_metadata);
        self.tb_metadata.copy_from(&source.tb_metadata);
        self.network.copy_from(&source.network);
    }
}
