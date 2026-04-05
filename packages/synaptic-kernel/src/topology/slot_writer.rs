use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct SlotWriter<'a, const SLOT_SIZE: usize> {
    pub(crate) triple_buffer: &'a TripleBufferWriter,
    pub(crate) tb_start_offset: usize,
    pub(crate) tb_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotWriter<'a, SLOT_SIZE> {
    pub fn new(triple_buffer: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + SLOT_SIZE;
        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "SlotWriter::create | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            SLOT_SIZE,
            triple_buffer.buffer_capacity(),
        );
        SlotWriter {
            triple_buffer: &triple_buffer,
            tb_start_offset,
            tb_end_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotWriter.read | offset {} out of bounds",
            offset
        );
        self.triple_buffer.read(self.tb_start_offset + offset)
    }

    pub(crate) fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotWriter.write | offset {} out of bounds",
            offset
        );
        self.triple_buffer
            .write(self.tb_start_offset + offset, value)
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }
}
