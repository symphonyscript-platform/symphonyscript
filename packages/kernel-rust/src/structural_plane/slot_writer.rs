use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct SlotWriter<'a, const SLOT_SIZE: usize> {
    pub(crate) writer: &'a TripleBufferWriter,
    pub(crate) start_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotWriter<'a, SLOT_SIZE> {
    pub fn new(writer: &'a TripleBufferWriter, start_offset: usize) -> Self {
        let end_index = start_offset + SLOT_SIZE;
        debug_assert!(
            end_index <= writer.buffer_capacity(),
            "SlotView out of bounds"
        );
        SlotWriter {
            writer: &writer,
            start_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        self.writer.read(self.start_offset + offset)
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        self.writer.write(self.start_offset + offset, value)
    }
}
