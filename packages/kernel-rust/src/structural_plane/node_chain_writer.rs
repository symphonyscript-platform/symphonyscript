use crate::structural_plane::node_view::{NodeData, NodeDraft, NodeView};
use crate::structural_plane::structural_writer::StructuralWriter;

pub struct NodeChainWriter<'a> {
    writer: &'a StructuralWriter<'a, { NodeView::SLOT_SIZE }>,
    capacity: i32,
}

impl<'a> NodeChainWriter<'a> {
    pub fn new(writer: &'a StructuralWriter<'a, { NodeView::SLOT_SIZE }>, capacity: i32) -> Self {
        debug_assert!(
            capacity <= writer.capacity(),
            "capacity ({}) must be <= writer capacity ({})",
            capacity,
            writer.capacity(),
        );

        NodeChainWriter { writer, capacity }
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: 0,
            next_ptr: 0,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        })
    }

    pub fn insert_after(&self, prev_slot: usize, data: NodeDraft) -> Option<usize> {
        debug_assert!(
            prev_slot > 0 && prev_slot <= self.capacity() as usize,
            "slot out of bounds"
        );
        let prev = NodeView(self.writer.get(prev_slot));
        let prev_next_slot = prev.get_next_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: prev_slot as i32,
            next_ptr: prev_next_slot,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        });

        match result {
            Some(new_slot) => {
                prev.set_next_ptr(new_slot as i32);
                if prev_next_slot != 0 {
                    let prev_next = NodeView(self.writer.get(prev_next_slot as usize));
                    prev_next.set_prev_ptr(new_slot as i32);
                }
                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn insert_before(&self, next_slot: usize, data: NodeDraft) -> Option<usize> {
        debug_assert!(
            next_slot > 0 && next_slot <= self.capacity() as usize,
            "slot out of bounds"
        );
        let next = NodeView(self.writer.get(next_slot));
        let next_prev_slot = next.get_prev_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: next_prev_slot,
            next_ptr: next_slot as i32,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        });

        match result {
            Some(new_slot) => {
                next.set_prev_ptr(new_slot as i32);
                if next_prev_slot != 0 {
                    let next_prev = NodeView(self.writer.get(next_prev_slot as usize));
                    next_prev.set_next_ptr(new_slot as i32);
                }
                Some(new_slot)
            }
            None => None,
        }
    }
}
