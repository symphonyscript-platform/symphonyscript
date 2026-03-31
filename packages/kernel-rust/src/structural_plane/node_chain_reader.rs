use crate::constants::NODE_SLOT_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::node_reader::NodeReader;
use crate::structural_plane::structural_reader::StructuralReader;

pub struct NodeChainReader<'a> {
    buffer: &'a TripleBufferReader,
    reader: &'a StructuralReader<'a, NODE_SLOT_SIZE>,
    head_ptr: usize,
    capacity: usize,
}

impl<'a> NodeChainReader<'a> {
    pub fn new(
        buffer: &'a TripleBufferReader,
        reader: &'a StructuralReader<'a, NODE_SLOT_SIZE>,
        head_ptr: usize,
        capacity: usize,
    ) -> Self {
        debug_assert!(
            capacity <= reader.capacity(),
            "capacity ({}) must be <= reader capacity ({})",
            capacity,
            reader.capacity(),
        );

        NodeChainReader {
            buffer,
            reader,
            head_ptr,
            capacity,
        }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get_head(&'_ self) -> Option<NodeReader<'_>> {
        let head_slot = self.buffer.read(self.head_ptr);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeReader<'_> {
        debug_assert!(slot > 0 && slot <= self.capacity(), "slot out of bounds");

        NodeReader(self.reader.get(slot))
    }
}
