use crate::primitives::triple_buffer::TripleBufferReader;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::node::node_reader::NodeReader;

#[derive(Clone)]
pub struct NodeChainReader<const META_SIZE: usize> {
    triple_buffer: TripleBufferReader,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const META_SIZE: usize> NodeChainReader<META_SIZE> {
    pub fn bind(
        triple_buffer: TripleBufferReader,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let tb_end_offset =
            tb_start_offset + NodeChainWriter::<META_SIZE>::calculate_size_on_tb(capacity);

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "NodeChainReader::bind | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        NodeChainReader {
            triple_buffer,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get_head_slot(&self) -> usize {
        self.triple_buffer.read(self.tb_start_offset) as usize
    }

    pub fn get_head(&'_ self) -> Option<NodeReader<'_, META_SIZE>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get_node(head_slot))
    }

    pub fn get_node(&'_ self, slot: usize) -> NodeReader<'_, META_SIZE> {
        let start_offset =
            NodeChainWriter::<META_SIZE>::calculate_node_start_offset(self.tb_start_offset, slot);
        NodeReader::new(&self.triple_buffer, start_offset)
    }
}
