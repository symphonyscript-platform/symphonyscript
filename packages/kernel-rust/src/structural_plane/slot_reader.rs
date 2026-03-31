use crate::primitives::triple_buffer::TripleBufferReader;

pub struct SlotReader<'a, const SLOT_SIZE: usize> {
    pub(crate) reader: &'a TripleBufferReader,
    pub(crate) start_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotReader<'a, SLOT_SIZE> {
    pub fn new(reader: &'a TripleBufferReader, start_offset: usize) -> Self {
        let end_index = start_offset + SLOT_SIZE;
        debug_assert!(
            end_index <= reader.buffer_capacity(),
            "SlotReader out of bounds"
        );
        SlotReader {
            reader: &reader,
            start_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        self.reader.read(self.start_offset + offset)
    }
}
