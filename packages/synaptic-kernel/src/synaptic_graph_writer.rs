use crate::attribute_plane::attribute_plane_writer::AttributePlaneWriter;
use crate::attribute_plane::attributes_writer::AttributesWriter;
use crate::constants::{GRAPH_MAGIC, KERNEL_VERSION};
use crate::errors::free_list_error::FreeListError;
use crate::metadata::mem_metadata_writer::MemMetadataWriter;
use crate::metadata::tb_metadata_writer::TbMetadataWriter;
use crate::primitives::into_array::IntoArray;
use crate::primitives::triple_buffer::{TripleBuffer, TripleBufferWriter};
use crate::primitives::types::AtomicBuffer;
use crate::synaptic_graph_config::SynapticGraphConfig;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::node::node_writer::NodeWriter;
use crate::topology::synapse::synapse_chain_writer::SynapseChainWriter;
use crate::topology::synapse::synapse_data::SynapseDraft;
use crate::topology::synapse::synapse_writer::SynapseWriter;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct SynapticGraphWriter<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
> {
    mem: AtomicBuffer,
    mem_metadata_plane: MemMetadataWriter,
    tb_metadata_plane: TbMetadataWriter,
    node_attribute_plane: AttributePlaneWriter<NODE_ATTRIBUTES_SIZE>,
    synapse_attribute_plane: AttributePlaneWriter<SYNAPSE_ATTRIBUTES_SIZE>,
    tb_writer: TripleBufferWriter,
    node_chain_writer: NodeChainWriter<NODE_META_SIZE>,
    synapse_chain_writer: SynapseChainWriter,
}

impl<
    const NODE_META_SIZE: usize,
    const NODE_ATTRIBUTES_SIZE: usize,
    const SYNAPSE_META_SIZE: usize,
    const SYNAPSE_ATTRIBUTES_SIZE: usize,
>
    SynapticGraphWriter<
        NODE_META_SIZE,
        NODE_ATTRIBUTES_SIZE,
        SYNAPSE_META_SIZE,
        SYNAPSE_ATTRIBUTES_SIZE,
    >
{
    pub const HEADERS_SIZE: usize = 2;

    pub fn new(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        assert!(
            mem[0].load(Ordering::Acquire) == 0 && mem[1].load(Ordering::Acquire) == 0,
            "Attempted to initialize SynapticGraphWriter on already allocated memory"
        );

        assert!(
            mem.len() >= Self::calculate_size_on_mem(&config),
            "Provided AtomicBuffer is too small for this configuration"
        );

        mem[0].store(GRAPH_MAGIC, Ordering::Release);
        mem[1].store(KERNEL_VERSION, Ordering::Release);

        let mem_start_offset = 2;
        let tb_start_offset = 0;

        let mem_metadata_plane =
            MemMetadataWriter::new(Arc::clone(&mem), mem_start_offset, config.mem_metadata_size);
        let node_attribute_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SIZE>::new(
            Arc::clone(&mem),
            mem_metadata_plane.mem_end_offset(),
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SIZE>::new(
            Arc::clone(&mem),
            node_attribute_plane.mem_end_offset(),
            config.synapse_capacity,
        );
        let (tb_writer, _) = TripleBuffer::new(
            Arc::clone(&mem),
            synapse_attribute_plane.mem_end_offset(),
            Self::calculate_size_on_tb(&config),
        );
        let tb_metadata_plane =
            TbMetadataWriter::new(tb_writer.clone(), tb_start_offset, config.tb_metadata_size);
        let node_chain_writer = NodeChainWriter::new(
            Arc::clone(&mem),
            tb_writer.clone(),
            tb_writer.mem_end_offset(),
            tb_metadata_plane.tb_end_offset(),
            config.node_capacity,
        );
        let synapse_chain_writer = SynapseChainWriter::new(
            Arc::clone(&mem),
            tb_writer.clone(),
            node_chain_writer.clone(),
            node_chain_writer.mem_end_offset(),
            node_chain_writer.tb_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphWriter {
            mem,
            mem_metadata_plane,
            tb_metadata_plane,
            node_attribute_plane,
            synapse_attribute_plane,
            tb_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn bind(mem: AtomicBuffer, config: SynapticGraphConfig) -> Self {
        assert_eq!(
            mem[0].load(Ordering::Acquire),
            GRAPH_MAGIC,
            "Attempted to initialize SynapticGraphWriter on foreign memory"
        );
        assert_eq!(
            mem[1].load(Ordering::Acquire),
            KERNEL_VERSION,
            "Attempted to initialize SynapticGraphWriter on mismatched AtomicBuffer version"
        );

        assert!(
            mem.len() >= Self::calculate_size_on_mem(&config),
            "Provided AtomicBuffer is too small for this configuration"
        );

        let mem_start_offset = 2;
        let tb_start_offset = 0;

        let mem_metadata_plane =
            MemMetadataWriter::bind(Arc::clone(&mem), mem_start_offset, config.mem_metadata_size);
        let node_attribute_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SIZE>::bind(
            Arc::clone(&mem),
            mem_metadata_plane.mem_end_offset(),
            config.node_capacity,
        );
        let synapse_attribute_plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SIZE>::bind(
            Arc::clone(&mem),
            node_attribute_plane.mem_end_offset(),
            config.synapse_capacity,
        );
        let tb_writer = TripleBuffer::bind_writer(
            Arc::clone(&mem),
            synapse_attribute_plane.mem_end_offset(),
            Self::calculate_size_on_tb(&config),
        );
        let tb_metadata_plane =
            TbMetadataWriter::bind(tb_writer.clone(), tb_start_offset, config.tb_metadata_size);
        let node_chain_writer = NodeChainWriter::bind(
            Arc::clone(&mem),
            tb_writer.clone(),
            tb_writer.mem_end_offset(),
            tb_metadata_plane.tb_end_offset(),
            config.node_capacity,
        );
        let synapse_chain_writer = SynapseChainWriter::bind(
            Arc::clone(&mem),
            tb_writer.clone(),
            node_chain_writer.clone(),
            node_chain_writer.mem_end_offset(),
            node_chain_writer.tb_end_offset(),
            config.synapse_capacity,
        );

        SynapticGraphWriter {
            mem,
            mem_metadata_plane,
            tb_metadata_plane,
            node_attribute_plane,
            synapse_attribute_plane,
            tb_writer,
            node_chain_writer,
            synapse_chain_writer,
        }
    }

    pub fn calculate_size_on_tb(config: &SynapticGraphConfig) -> usize {
        TbMetadataWriter::calculate_size_on_tb(config.tb_metadata_size)
            + NodeChainWriter::calculate_size_on_tb(config.node_capacity)
            + SynapseChainWriter::calculate_size_on_tb(config.synapse_capacity)
    }

    pub fn calculate_size_on_mem(config: &SynapticGraphConfig) -> usize {
        Self::HEADERS_SIZE
            + MemMetadataWriter::calculate_size_on_mem(config.mem_metadata_size)
            + NodeChainWriter::calculate_size_on_mem(config.node_capacity)
            + SynapseChainWriter::calculate_size_on_mem(config.synapse_capacity)
            + AttributePlaneWriter::<NODE_ATTRIBUTES_SIZE>::calculate_size(config.node_capacity)
            + AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SIZE>::calculate_size(
                config.synapse_capacity,
            )
            + TripleBuffer::calculate_size(Self::calculate_size_on_tb(config))
    }

    pub fn mem_metadata_capacity(&self) -> usize {
        self.mem_metadata_plane.capacity()
    }

    pub fn tb_metadata_capacity(&self) -> usize {
        self.tb_metadata_plane.capacity()
    }

    pub fn mem_read_meta(&self, offset: usize) -> i32 {
        self.mem_metadata_plane.read(offset)
    }

    pub fn mem_write_meta(&self, offset: usize, value: i32) {
        self.mem_metadata_plane.write(offset, value);
    }

    pub fn tb_read_meta(&self, offset: usize) -> i32 {
        self.tb_metadata_plane.read(offset)
    }

    pub fn tb_write_meta(&self, offset: usize, value: i32) {
        self.tb_metadata_plane.write(offset, value);
    }

    pub fn node_capacity(&self) -> usize {
        self.node_chain_writer.capacity()
    }

    pub fn node_count(&self) -> usize {
        self.node_chain_writer.count()
    }

    pub fn node_utilization(&self) -> f32 {
        self.node_chain_writer.utilization()
    }

    pub fn synapse_capacity(&self) -> usize {
        self.synapse_chain_writer.capacity()
    }

    pub fn synapse_count(&self) -> usize {
        self.synapse_chain_writer.count()
    }

    pub fn synapse_utilization(&self) -> f32 {
        self.synapse_chain_writer.utilization()
    }

    pub fn peek_utilization(&self) -> f32 {
        self.node_utilization().max(self.synapse_utilization())
    }

    pub fn get_head_node_slot(&self) -> usize {
        self.node_chain_writer.get_head_slot()
    }

    pub fn get_head_node(&'_ self) -> Option<NodeWriter<'_, NODE_META_SIZE>> {
        self.node_chain_writer.get_head()
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeWriter<'_, NODE_META_SIZE> {
        self.node_chain_writer.get_node(slot)
    }

    pub fn get_node_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<'_, NODE_ATTRIBUTES_SIZE> {
        debug_assert!(
            self.node_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.get_node_attributes | attempted to read inactive slot {}",
            slot
        );
        self.node_attribute_plane.get(slot)
    }

    pub fn get_node_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        debug_assert!(
            self.node_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.get_node_attribute | attempted to read inactive slot {}",
            slot
        );
        self.node_attribute_plane.get(slot).read(attribute_offset)
    }

    pub fn set_node_attributes<T: IntoArray<NODE_ATTRIBUTES_SIZE>>(&'_ self, slot: usize, data: T) {
        debug_assert!(
            self.node_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.set_node_attributes | attempted to read inactive slot {}",
            slot
        );
        self.node_attribute_plane.set(slot, data)
    }

    pub fn set_node_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        debug_assert!(
            self.node_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.set_node_attribute | attempted to read inactive slot {}",
            slot
        );
        self.node_attribute_plane
            .get(slot)
            .write(attribute_offset, value)
    }

    pub fn insert_head(&self, kind: i32) -> Option<usize> {
        self.node_chain_writer.insert_head(kind)
    }

    pub fn insert_after(&self, prev_slot: usize, kind: i32) -> Option<usize> {
        self.node_chain_writer.insert_after(prev_slot, kind)
    }

    pub fn insert_before(&self, next_slot: usize, kind: i32) -> Option<usize> {
        self.node_chain_writer.insert_before(next_slot, kind)
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), FreeListError> {
        self.node_chain_writer.remove(slot)
    }

    pub fn get_synapse(&'_ self, slot: usize) -> SynapseWriter<'_> {
        self.synapse_chain_writer.get(slot)
    }

    pub fn get_synapse_attributes(
        &'_ self,
        slot: usize,
    ) -> AttributesWriter<'_, SYNAPSE_ATTRIBUTES_SIZE> {
        debug_assert!(
            self.synapse_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.get_synapse_attributes | attempted to read inactive slot {}",
            slot
        );
        self.synapse_attribute_plane.get(slot)
    }

    pub fn get_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize) -> i32 {
        debug_assert!(
            self.synapse_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.get_synapse_attribute | attempted to read inactive slot {}",
            slot
        );
        self.synapse_attribute_plane
            .get(slot)
            .read(attribute_offset)
    }

    pub fn set_synapse_attributes<T: IntoArray<SYNAPSE_ATTRIBUTES_SIZE>>(
        &'_ self,
        slot: usize,
        data: T,
    ) {
        debug_assert!(
            self.synapse_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.set_synapse_attributes | attempted to read inactive slot {}",
            slot
        );
        self.synapse_attribute_plane.set(slot, data)
    }

    pub fn set_synapse_attribute(&'_ self, slot: usize, attribute_offset: usize, value: i32) {
        debug_assert!(
            self.synapse_chain_writer.is_active_slot(slot),
            "SynapticGraphWriter.set_synapse_attribute | attempted to read inactive slot {}",
            slot
        );
        self.synapse_attribute_plane
            .get(slot)
            .write(attribute_offset, value)
    }

    pub fn connect(
        &self,
        source_slot: usize,
        target_slot: usize,
        data: SynapseDraft,
    ) -> Option<usize> {
        self.synapse_chain_writer
            .connect(source_slot, target_slot, data)
    }

    pub fn disconnect(&self, slot: usize) -> Result<(), FreeListError> {
        self.synapse_chain_writer.disconnect(slot)
    }

    pub fn publish(&mut self) {
        self.node_chain_writer.flush_deferred();
        self.synapse_chain_writer.flush_deferred();
        self.tb_writer.publish();
    }

    pub fn get_mem(&self) -> AtomicBuffer {
        Arc::clone(&self.mem)
    }

    pub fn copy_from(&self, source: &Self) {
        self.node_attribute_plane
            .copy_from(&source.node_attribute_plane);
        self.synapse_attribute_plane
            .copy_from(&source.synapse_attribute_plane);
        self.tb_writer.copy_metadata_from(&source.tb_writer);
        self.node_chain_writer.copy_from(&source.node_chain_writer);
        self.synapse_chain_writer
            .copy_from(&source.synapse_chain_writer);
    }
}
