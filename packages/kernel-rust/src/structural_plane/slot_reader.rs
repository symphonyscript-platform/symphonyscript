use crate::primitives::triple_buffer::TripleBufferReader;

pub struct SlotReader<'a, const SLOT_SIZE: usize> {
    pub(crate) reader: &'a TripleBufferReader,
    pub(crate) triple_buffer_start_offset: usize,
    pub(crate) triple_buffer_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotReader<'a, SLOT_SIZE> {
    pub fn new(reader: &'a TripleBufferReader, triple_buffer_start_offset: usize) -> Self {
        let triple_buffer_end_offset = triple_buffer_start_offset + SLOT_SIZE;
        debug_assert!(
            triple_buffer_end_offset <= reader.buffer_capacity(),
            "SlotReader::create | range [{}..{}] exceeds buffer capacity {}",
            triple_buffer_start_offset,
            SLOT_SIZE,
            reader.buffer_capacity(),
        );
        SlotReader {
            reader: &reader,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotReader.read | offset {} out of bounds",
            offset
        );
        self.reader.read(self.triple_buffer_start_offset + offset)
    }

    pub fn triple_buffer_start_offset(&self) -> usize {
        self.triple_buffer_start_offset
    }

    pub fn triple_buffer_end_offset(&self) -> usize {
        self.triple_buffer_end_offset
    }
}
