use crate::constants::NODE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::structural_plane::node::node_writer::{NodeData, NodeDraft, NodeWriter};
use crate::structural_plane::structural_writer::StructuralWriter;

pub struct NodeChainWriter<'a> {
    buffer: &'a TripleBufferWriter,
    writer: &'a StructuralWriter<'a, NODE_SLOT_SIZE>,
    buffer_head_offset: usize,
}

impl<'a> NodeChainWriter<'a> {
    pub fn new(
        buffer: &'a TripleBufferWriter,
        writer: &'a StructuralWriter<'a, NODE_SLOT_SIZE>,
        buffer_head_offset: usize,
    ) -> Self {
        debug_assert!(
            buffer_head_offset < buffer.buffer_capacity(),
            "buffer_head_offset ({}) out of bounds",
            buffer_head_offset,
        );

        NodeChainWriter {
            buffer,
            writer,
            buffer_head_offset,
        }
    }

    pub fn get_head(&'_ self) -> Option<NodeWriter<'_>> {
        let head_slot = self.buffer.read(self.buffer_head_offset);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeWriter<'_> {
        NodeWriter(self.writer.get(slot))
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        let current_head_slot = self.buffer.read(self.buffer_head_offset);
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: 0,
            next_ptr: current_head_slot as usize,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        });

        match result {
            Some(slot) => {
                if current_head_slot != 0 {
                    let current_head = self.get(current_head_slot as usize);
                    current_head.set_prev_ptr(slot);
                }

                self.buffer.write(self.buffer_head_offset, slot as i32);
                Some(slot)
            }
            None => None,
        }
    }

    pub fn insert_after(&self, prev_slot: usize, data: NodeDraft) -> Option<usize> {
        let prev = self.get(prev_slot);
        let prev_next_slot = prev.get_next_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: prev_slot,
            next_ptr: prev_next_slot,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        });

        match result {
            Some(new_slot) => {
                prev.set_next_ptr(new_slot);
                if prev_next_slot != 0 {
                    let prev_next = self.get(prev_next_slot);
                    prev_next.set_prev_ptr(new_slot);
                }
                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn insert_before(&self, next_slot: usize, data: NodeDraft) -> Option<usize> {
        let next = self.get(next_slot);
        let next_prev_slot = next.get_prev_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: next_prev_slot,
            next_ptr: next_slot,
            synapse_list_head: 0,
            reverse_synapse_head: 0,
            mod_list_head: 0,
        });

        match result {
            Some(new_slot) => {
                next.set_prev_ptr(new_slot);
                if next_prev_slot != 0 {
                    let next_prev = self.get(next_prev_slot as usize);
                    next_prev.set_next_ptr(new_slot);
                }
                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn remove(&self, slot: usize) -> Result<(), FreeListError> {
        let node = self.get(slot);
        let prev_slot = node.get_prev_ptr();
        let next_slot = node.get_next_ptr();

        if prev_slot != 0 {
            self.get(prev_slot as usize).set_next_ptr(next_slot);
        }

        if next_slot != 0 {
            self.get(next_slot as usize).set_prev_ptr(prev_slot);
        }

        self.writer.free(slot)
    }
}
