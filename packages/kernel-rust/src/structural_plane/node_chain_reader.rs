use crate::structural_plane::node_reader::NodeReader;
use crate::structural_plane::node_writer::NodeWriter;
use crate::structural_plane::structural_reader::StructuralReader;

pub struct NodeChainReader<'a> {
    reader: &'a StructuralReader<'a, { NodeWriter::SLOT_SIZE }>,
    capacity: i32,
}

impl<'a> NodeChainReader<'a> {
    pub fn new(reader: &'a StructuralReader<'a, { NodeWriter::SLOT_SIZE }>, capacity: i32) -> Self {
        debug_assert!(
            capacity <= reader.capacity(),
            "capacity ({}) must be <= writer capacity ({})",
            capacity,
            reader.capacity(),
        );

        NodeChainReader { reader, capacity }
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> NodeReader<'_> {
        debug_assert!(
            slot > 0 && slot <= self.capacity() as usize,
            "slot out of bounds"
        );

        NodeReader(self.reader.get(slot))
    }
}
