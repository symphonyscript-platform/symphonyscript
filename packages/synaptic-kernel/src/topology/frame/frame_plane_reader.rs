use crate::constants::NODE_SIZE;
use crate::primitives::triple_buffer::TripleBufferReader;
use crate::topology::node::node_reader::NodeReader;
use crate::topology::topology_reader::TopologyReader;

#[derive(Clone)]
pub struct FramePlaneWriter {
    triple_buffer: TripleBufferReader,
    topology: TopologyReader<NODE_SIZE>,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl FramePlaneWriter {
    pub fn new(triple_buffer: TripleBufferReader, tb_start_offset: usize, capacity: usize) -> Self {
        let topology =
            TopologyReader::<NODE_SIZE>::new(triple_buffer.clone(), tb_start_offset, capacity);
        let tb_end_offset = topology.tb_end_offset();

        FramePlaneWriter {
            triple_buffer,
            topology,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn bind(
        triple_buffer: TripleBufferReader,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let topology =
            TopologyReader::<NODE_SIZE>::bind(triple_buffer.clone(), tb_start_offset + 1, capacity);
        let tb_end_offset = topology.tb_end_offset();

        FramePlaneWriter {
            triple_buffer,
            topology,
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

    pub fn get(&'_ self, slot: usize) -> NodeReader<'_> {
        NodeReader(self.topology.get(slot))
    }
}
