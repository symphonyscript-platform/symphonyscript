use crate::constants::NODE_SLOT_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::node::node_reader::NodeReader;
use crate::structural_plane::structural_reader::StructuralReader;

pub struct NodeChainReader<'a> {
    buffer: &'a TripleBufferReader,
    reader: &'a StructuralReader<'a, NODE_SLOT_SIZE>,
    buffer_head_offset: usize,
}

impl<'a> NodeChainReader<'a> {
    pub fn new(
        buffer: &'a TripleBufferReader,
        reader: &'a StructuralReader<'a, NODE_SLOT_SIZE>,
        buffer_head_offset: usize,
    ) -> Self {
        NodeChainReader {
            buffer,
            reader,
            buffer_head_offset,
        }
    }

    pub fn get_head(&'_ self) -> Option<NodeReader<'_>> {
        let head_slot = self.buffer.read(self.buffer_head_offset);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeReader<'_> {
        NodeReader(self.reader.get(slot))
    }
}
