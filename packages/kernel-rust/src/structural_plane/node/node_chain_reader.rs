use crate::constants::NODE_SLOT_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::node::node_reader::NodeReader;
use crate::structural_plane::structural_reader::StructuralReader;

#[derive(Clone)]
pub struct NodeChainReader {
    buffer: TripleBufferReader,
    reader: StructuralReader<NODE_SLOT_SIZE>,
    triple_buffer_start_offset: usize,
    triple_buffer_end_offset: usize,
    capacity: usize,
}

impl NodeChainReader {
    pub fn new(
        buffer: TripleBufferReader,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let reader = StructuralReader::<NODE_SLOT_SIZE>::new(
            buffer.clone(),
            triple_buffer_start_offset + 1,
            capacity,
        );
        let triple_buffer_end_offset = reader.triple_buffer_end_offset();

        NodeChainReader {
            buffer,
            reader,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn bind(
        buffer: TripleBufferReader,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let reader = StructuralReader::<NODE_SLOT_SIZE>::bind(
            buffer.clone(),
            triple_buffer_start_offset + 1,
            capacity,
        );
        let triple_buffer_end_offset = reader.triple_buffer_end_offset();

        NodeChainReader {
            buffer,
            reader,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn triple_buffer_start_offset(&self) -> usize {
        self.triple_buffer_start_offset
    }

    pub fn triple_buffer_end_offset(&self) -> usize {
        self.triple_buffer_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get_head(&'_ self) -> Option<NodeReader<'_>> {
        let head_slot = self.buffer.read(self.triple_buffer_start_offset);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeReader<'_> {
        NodeReader(self.reader.get(slot))
    }
}
