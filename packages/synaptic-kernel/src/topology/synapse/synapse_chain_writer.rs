use crate::constants::SYNAPSE_STRIDE;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::entry_store_writer::EntryStoreWriter;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::staging_buffer_reader::StagingBufferReader;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::synapse::synapse_chain_reader::SynapseChainReader;
use crate::topology::synapse::synapse_writer::SynapseWriter;

/// Producer-side triple-buffered multi-linked list for graph synapses.
///
/// Orchestrates allocation, lifecycle, and structural linkage of synapses.
/// Every active synapse maintains two separate doubly-linked lists concurrently:
/// One anchoring it to the source node's `outgoing` list, and another to
/// the target node's `incoming` list.
///
/// Uses `SlotAllocator` to manage synapse slot lifecycles.
///
/// # Threading
/// Producer thread only.
///
/// # Memory Layout (Triple Buffer Plane)
/// ```text
/// Offset      Size        Field
/// -------------------------------------
/// 0           N*(S+M)     synapses
///
/// N = capacity
/// S = SYNAPSE_STRIDE (8)
/// M = SYNAPSE_META_STRIDE (const generic)
/// ```
///
/// Note: There is no global `head_slot` parameter on the synapse plane.
/// Synapses are accessed by traversing from a specific node.
///
/// # Constraints
/// - Slots are 1-based. 0 indicates an undefined state.
/// - Requires access to the `NodeChainWriter` because connecting/disconnecting
///   automatically updates the head/tail pointers of the affected nodes.
/// - Built-in lifecycle safety: `disconnect()` marks the slot for deferred freeing,
///   preventing reallocation until the consumer has advanced pas the pending `publish()`.
/// - Use `to_reader()` to create the paired `SynapseChainReader`.
#[derive(Clone)]
pub struct SynapseChainWriter<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    node_chain: NodeChainWriter<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
    ds: EntryStoreWriter<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
>
    SynapseChainWriter<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >
{
    pub fn new(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            tb,
            node_chain,
            mem_start_offset,
            tb_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            tb,
            node_chain,
            mem_start_offset,
            tb_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        node_chain: NodeChainWriter<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        SynapseChainWriter {
            node_chain,
            ds: EntryStoreWriter::create(
                mem,
                tb,
                mem_start_offset,
                tb_start_offset,
                capacity,
                bind,
            ),
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        SlotAllocator::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity * (SYNAPSE_STRIDE + SYNAPSE_META_STRIDE)
    }

    pub(crate) fn calculate_synapse_start_offset(tb_start_offset: usize, slot: usize) -> usize {
        tb_start_offset + (slot - 1) * (SYNAPSE_STRIDE + SYNAPSE_META_STRIDE)
    }

    pub fn to_reader(&self) -> SynapseChainReader<SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        SynapseChainReader::bind(self.ds.to_reader())
    }

    pub fn to_staging_buffer_reader(&self) -> StagingBufferReader {
        self.ds.to_staging_buffer_reader()
    }

    pub fn len(&self) -> usize {
        self.ds.len()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.ds.mem_start_offset()
    }

    pub fn mem_end_offset(&self) -> usize {
        self.ds.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.ds.tb_start_offset()
    }

    pub fn tb_end_offset(&self) -> usize {
        self.ds.tb_end_offset()
    }

    pub fn capacity(&self) -> usize {
        self.ds.capacity()
    }

    pub fn utilization(&self) -> f32 {
        self.ds.utilization()
    }

    pub fn get_synapse(
        &'_ self,
        slot: usize,
    ) -> SynapseWriter<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        SynapseWriter::new(self.ds.get(slot))
    }

    pub fn connect(&self, source_slot: usize, target_slot: usize, kind: i32) -> Option<usize> {
        let source = self.node_chain.get_node(source_slot);
        let target = self.node_chain.get_node(target_slot);
        let source_current_tail_ptr = source.get_outgoing_synapse_tail();
        let target_current_tail_ptr = target.get_incoming_synapse_tail();
        let result = self.ds.insert();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let synapse = self.get_synapse(new_slot);

        synapse.set_kind(kind);
        synapse.set_source_ptr(source_slot);
        synapse.set_target_ptr(target_slot);
        synapse.set_outgoing_next_ptr(0);
        synapse.set_outgoing_prev_ptr(source_current_tail_ptr);
        synapse.set_incoming_next_ptr(0);
        synapse.set_incoming_prev_ptr(target_current_tail_ptr);

        if source.get_outgoing_synapse_head() == 0 {
            source.set_outgoing_synapse_head(new_slot);
        }

        if target.get_incoming_synapse_head() == 0 {
            target.set_incoming_synapse_head(new_slot);
        }

        if source_current_tail_ptr != 0 {
            self.get_synapse(source_current_tail_ptr)
                .set_outgoing_next_ptr(new_slot);
        }

        if target_current_tail_ptr != 0 {
            self.get_synapse(target_current_tail_ptr)
                .set_incoming_next_ptr(new_slot);
        }

        source.set_outgoing_synapse_tail(new_slot);
        target.set_incoming_synapse_tail(new_slot);

        Some(new_slot)
    }

    pub fn disconnect(
        &self,
        source_ptr: usize,
        target_ptr: usize,
    ) -> Result<(), SlotAllocatorError> {
        let source = self.node_chain.get_node(source_ptr);
        let mut synapse = source.get_outgoing_synapse_head();

        while synapse != 0 {
            let synapse_handle = self.get_synapse(synapse);
            let next_synapse = synapse_handle.get_outgoing_next_ptr();

            if synapse_handle.get_target_ptr() == target_ptr {
                self.disconnect_synapse(synapse)?;
            }

            synapse = next_synapse;
        }

        Ok(())
    }

    pub fn disconnect_synapse(&self, synapse_slot: usize) -> Result<(), SlotAllocatorError> {
        let synapse = self.get_synapse(synapse_slot);
        let source = self.node_chain.get_node(synapse.get_source_ptr());
        let target = self.node_chain.get_node(synapse.get_target_ptr());
        let synapse_outgoing_next_ptr = synapse.get_outgoing_next_ptr();
        let synapse_outgoing_prev_ptr = synapse.get_outgoing_prev_ptr();
        let synapse_incoming_next_ptr = synapse.get_incoming_next_ptr();
        let synapse_incoming_prev_ptr = synapse.get_incoming_prev_ptr();

        self.ds.remove(synapse_slot)?;

        if synapse_outgoing_prev_ptr != 0 {
            self.get_synapse(synapse_outgoing_prev_ptr)
                .set_outgoing_next_ptr(synapse_outgoing_next_ptr);
        } else {
            source.set_outgoing_synapse_head(synapse_outgoing_next_ptr);
        }

        if synapse_outgoing_next_ptr != 0 {
            self.get_synapse(synapse_outgoing_next_ptr)
                .set_outgoing_prev_ptr(synapse_outgoing_prev_ptr);
        } else {
            source.set_outgoing_synapse_tail(synapse_outgoing_prev_ptr);
        }

        if synapse_incoming_prev_ptr != 0 {
            self.get_synapse(synapse_incoming_prev_ptr)
                .set_incoming_next_ptr(synapse_incoming_next_ptr);
        } else {
            target.set_incoming_synapse_head(synapse_incoming_next_ptr);
        }

        if synapse_incoming_next_ptr != 0 {
            self.get_synapse(synapse_incoming_next_ptr)
                .set_incoming_prev_ptr(synapse_incoming_prev_ptr);
        } else {
            target.set_incoming_synapse_tail(synapse_incoming_prev_ptr);
        }

        Ok(())
    }

    pub fn publish(&self) {
        self.ds.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity() <= self.capacity(),
            "SynapseChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity(),
            self.capacity(),
        );
        self.ds.copy_from(&source.ds);
    }
}
