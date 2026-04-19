use crate::constants::SYNAPSE_STRIDE;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::entry_store_writer::EntryStoreWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::network::network_reader::NetworkReader;
use crate::topology::network::synapse_view::SynapseView;
use crate::topology::network::synapse_writer::SynapseWriter;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::node::node_view::NodeView;
use crate::topology::node::node_writer::NodeWriter;
use std::sync::Arc;

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
/// - Built-in lifecycle safety: `disconnect()` marks the slot for deferred freeing,
///   preventing reallocation until the consumer has advanced pas the pending `publish()`.
/// - Use `to_reader()` to create the paired `NetworkReader`.
#[derive(Clone)]
pub struct NetworkWriter<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
> {
    node_chain: NodeChainWriter<NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>,
    pub(crate) synapses:
        EntryStoreWriter<SYNAPSE_STRIDE, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE>,
}

impl<
    const NODE_META_STRIDE: usize,
    const NODE_ATTRIBUTES_STRIDE: usize,
    const SYNAPSE_META_STRIDE: usize,
    const SYNAPSE_ATTRIBUTES_STRIDE: usize,
>
    NetworkWriter<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    >
{
    pub fn new(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        node_capacity: usize,
        synapse_capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            tb,
            mem_start_offset,
            tb_start_offset,
            node_capacity,
            synapse_capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        node_capacity: usize,
        synapse_capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            tb,
            mem_start_offset,
            tb_start_offset,
            node_capacity,
            synapse_capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        node_capacity: usize,
        synapse_capacity: usize,
        bind: bool,
    ) -> Self {
        let node_chain = NodeChainWriter::create(
            Arc::clone(&mem),
            tb.clone(),
            mem_start_offset,
            tb_start_offset,
            node_capacity,
            bind,
        );
        let synapses = EntryStoreWriter::create(
            mem,
            tb,
            node_chain.mem_end_offset(),
            node_chain.tb_end_offset(),
            synapse_capacity,
            bind,
        );

        NetworkWriter {
            node_chain,
            synapses,
        }
    }

    pub fn calculate_size_on_mem(node_capacity: usize, synapse_capacity: usize) -> usize {
        NodeChainWriter::calculate_size_on_mem(node_capacity)
            + EntryStoreWriter::calculate_size_on_mem(synapse_capacity)
    }

    pub fn calculate_size_on_tb(node_capacity: usize, synapse_capacity: usize) -> usize {
        NodeChainWriter::calculate_size_on_tb(node_capacity)
            + synapse_capacity * (SYNAPSE_STRIDE + SYNAPSE_META_STRIDE)
    }

    pub fn to_reader(
        &self,
    ) -> NetworkReader<
        NODE_META_STRIDE,
        NODE_ATTRIBUTES_STRIDE,
        SYNAPSE_META_STRIDE,
        SYNAPSE_ATTRIBUTES_STRIDE,
    > {
        NetworkReader::bind(self.node_chain.to_reader(), self.synapses.to_reader())
    }

    pub fn len(&self) -> usize {
        self.synapses.len()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.node_chain.mem_start_offset()
    }

    pub fn mem_end_offset(&self) -> usize {
        self.synapses.mem_end_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.node_chain.tb_start_offset()
    }

    pub fn tb_end_offset(&self) -> usize {
        self.synapses.tb_end_offset()
    }

    pub fn node_capacity(&self) -> usize {
        self.node_chain.capacity()
    }

    pub fn node_count(&self) -> usize {
        self.node_chain.len()
    }

    pub fn node_utilization(&self) -> f32 {
        self.node_chain.utilization()
    }

    pub fn synapse_capacity(&self) -> usize {
        self.synapses.capacity()
    }

    pub fn synapse_count(&self) -> usize {
        self.synapses.len()
    }

    pub fn synapse_utilization(&self) -> f32 {
        self.synapses.utilization()
    }

    pub fn peek_utilization(&self) -> f32 {
        self.node_utilization().max(self.synapse_utilization())
    }

    #[inline]
    pub fn get_head_node(
        &'_ self,
    ) -> Option<NodeWriter<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>> {
        self.node_chain.get_head_node()
    }

    #[inline]
    pub fn get_node(
        &'_ self,
        slot: usize,
    ) -> NodeWriter<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE> {
        self.node_chain.get_node(slot)
    }

    pub fn get_synapse(
        &'_ self,
        slot: usize,
    ) -> SynapseWriter<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        SynapseWriter::new(self.synapses.get(slot))
    }

    #[inline]
    pub fn get_head_node_view(
        &'_ self,
    ) -> Option<NodeView<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE>> {
        self.node_chain.get_head_node_view()
    }

    #[inline]
    pub fn get_node_view(
        &'_ self,
        slot: usize,
    ) -> NodeView<'_, NODE_META_STRIDE, NODE_ATTRIBUTES_STRIDE> {
        self.node_chain.get_node_view(slot)
    }

    pub fn get_synapse_view(
        &'_ self,
        slot: usize,
    ) -> SynapseView<'_, SYNAPSE_META_STRIDE, SYNAPSE_ATTRIBUTES_STRIDE> {
        SynapseView::new(self.synapses.get_view(slot))
    }

    pub fn insert_head_node(&self, kind: i32) -> Option<usize> {
        self.node_chain.insert_head_node(kind)
    }

    pub fn insert_node_after(&self, prev_slot: usize, kind: i32) -> Option<usize> {
        self.node_chain.insert_node_after(prev_slot, kind)
    }

    pub fn insert_node_before(&self, next_slot: usize, kind: i32) -> Option<usize> {
        self.node_chain.insert_node_before(next_slot, kind)
    }

    pub fn remove_node(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        loop {
            let head = self.node_chain.get_node(slot).get_outgoing_synapse_head();

            if head == 0 {
                break;
            }

            self.disconnect_synapse(head)?;
        }

        loop {
            let head = self.node_chain.get_node(slot).get_incoming_synapse_head();

            if head == 0 {
                break;
            }

            self.disconnect_synapse(head)?;
        }

        self.node_chain.remove_node(slot)
    }

    pub fn connect(&self, source_slot: usize, target_slot: usize, kind: i32) -> Option<usize> {
        let source = self.node_chain.get_node(source_slot);
        let target = self.node_chain.get_node(target_slot);
        let source_current_tail_ptr = source.get_outgoing_synapse_tail();
        let target_current_tail_ptr = target.get_incoming_synapse_tail();
        let result = self.synapses.insert();

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

        self.synapses.remove(synapse_slot)?;

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
        self.node_chain.publish();
        self.synapses.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.node_capacity() <= self.node_capacity(),
            "NetworkWriter.copy_from | source.node_capacity() {} cannot be greater than destination.capacity {}",
            source.node_capacity(),
            self.node_capacity(),
        );

        debug_assert!(
            source.synapse_capacity() <= self.synapse_capacity(),
            "NetworkWriter.copy_from | source.synapse_capacity() {} cannot be greater than destination.capacity {}",
            source.synapse_capacity(),
            self.synapse_capacity(),
        );

        self.node_chain.copy_from(&source.node_chain);
        self.synapses.copy_from(&source.synapses);
    }
}
