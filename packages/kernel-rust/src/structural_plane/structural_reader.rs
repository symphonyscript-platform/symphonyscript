use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::slot_reader::SlotReader;

pub struct StructuralReader<'a, const SLOT_SIZE: usize> {
    reader: &'a TripleBufferReader,
    start_offset: usize,
    end_offset: usize,
    capacity: i32,
}

impl<'a, const SLOT_SIZE: usize> StructuralReader<'a, SLOT_SIZE> {
    pub fn new(reader: &'a TripleBufferReader, start_offset: usize, capacity: i32) -> Self {
        let end_offset = start_offset + (capacity as usize) * SLOT_SIZE;

        debug_assert!(
            end_offset <= reader.buffer_capacity(),
            "node region ({}) exceeds reader buffer capacity ({})",
            end_offset,
            reader.buffer_capacity(),
        );

        StructuralReader {
            reader,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn resolve_reader_offset(&self, slot: usize) -> usize {
        self.start_offset + slot * SLOT_SIZE
    }

    pub fn end_index(&self) -> usize {
        self.end_offset
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> SlotReader<'_, SLOT_SIZE> {
        debug_assert!(slot > 0 && slot <= self.capacity() as usize, "slot out of bounds");
        let start_offset = self.resolve_reader_offset(slot);

        SlotReader {
            reader: &self.reader,
            start_offset,
        }
    }

    pub fn read_field(&'_ self, slot: usize, offset: usize) -> i32 {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        let start_offset = self.resolve_reader_offset(slot);
        self.reader.read(start_offset + offset)
    }
}
