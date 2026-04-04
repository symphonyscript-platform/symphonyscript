use crate::primitives::triple_buffer::TripleBufferReader;
use crate::structural_plane::slot_reader::SlotReader;

#[derive(Clone)]
pub struct StructuralReader<const SLOT_SIZE: usize> {
    reader: TripleBufferReader,
    triple_buffer_start_offset: usize,
    triple_buffer_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> StructuralReader<SLOT_SIZE> {
    pub fn new(reader: TripleBufferReader, triple_buffer_start_offset: usize, capacity: usize) -> Self {
        let triple_buffer_end_offset = triple_buffer_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            triple_buffer_end_offset <= reader.buffer_capacity(),
            "StructuralReader::new | range [{}..{}] exceeds buffer capacity {}",
            triple_buffer_start_offset,
            capacity * SLOT_SIZE,
            reader.buffer_capacity(),
        );

        StructuralReader {
            reader,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn bind(reader: TripleBufferReader, start_offset: usize, capacity: usize) -> Self {
        Self::new(reader, start_offset, capacity)
    }

    pub fn resolve_reader_offset(&self, slot: usize) -> usize {
        self.triple_buffer_start_offset + (slot - 1) * SLOT_SIZE
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

    pub fn get(&'_ self, slot: usize) -> SlotReader<'_, SLOT_SIZE> {
        debug_assert!(
            slot > 0 && slot <= self.capacity(),
            "StructuralReader.get | slot {} out of bounds",
            slot
        );
        let start_offset = self.resolve_reader_offset(slot);

        SlotReader::new(&self.reader, start_offset)
    }

    pub fn read_field(&'_ self, slot: usize, offset: usize) -> i32 {
        debug_assert!(
            slot > 0 && slot <= self.capacity(),
            "StructuralReader.read_field | slot {} out of bounds",
            slot
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "StructuralReader.read_field | offset {} out of bounds",
            offset
        );
        let start_offset = self.resolve_reader_offset(slot);
        self.reader.read(start_offset + offset)
    }
}
