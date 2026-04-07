use crate::primitives::triple_buffer_reader::TripleBufferReader;

pub struct SlotReader<'a, const SLOT_SIZE: usize> {
    pub(crate) triple_buffer: &'a TripleBufferReader,
    pub(crate) tb_start_offset: usize,
    pub(crate) tb_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotReader<'a, SLOT_SIZE> {
    pub fn new(triple_reader: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + SLOT_SIZE;
        debug_assert!(
            tb_end_offset <= triple_reader.buffer_capacity(),
            "SlotReader::create | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            SLOT_SIZE,
            triple_reader.buffer_capacity(),
        );
        SlotReader {
            triple_buffer: &triple_reader,
            tb_start_offset,
            tb_end_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotReader.read | offset {} out of bounds",
            offset
        );
        self.triple_buffer.read(self.tb_start_offset + offset)
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }
}
