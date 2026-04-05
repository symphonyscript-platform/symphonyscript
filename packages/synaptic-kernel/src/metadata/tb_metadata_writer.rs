use crate::primitives::triple_buffer::TripleBufferWriter;

#[derive(Clone)]
pub struct TbMetadataWriter {
    buffer: TripleBufferWriter,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl TbMetadataWriter {
    pub fn new(buffer: TripleBufferWriter, tb_start_offset: usize, capacity: usize) -> Self {
        Self::create(buffer, tb_start_offset, capacity, false)
    }

    pub fn bind(buffer: TripleBufferWriter, tb_start_offset: usize, capacity: usize) -> Self {
        Self::create(buffer, tb_start_offset, capacity, true)
    }

    pub fn create(
        buffer: TripleBufferWriter,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            capacity > 0,
            "TbMetadataWriter::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "TbMetadataWriter::create | capacity {} must be power of 2",
            capacity
        );

        let tb_end_offset = tb_start_offset + capacity;

        debug_assert!(
            tb_end_offset <= buffer.buffer_capacity(),
            "TbMetadataWriter::create | range [{}..{}] exceeds buffer boundaries",
            tb_start_offset,
            buffer.buffer_capacity()
        );

        if !bind {
            for i in 0..capacity {
                buffer.write(tb_start_offset + i, 0);
            }
        }

        TbMetadataWriter {
            buffer,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity
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

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < self.capacity,
            "TbMetadataWriter.write | offset {} out of bounds",
            offset
        );
        self.buffer.write(self.tb_start_offset + offset, value);
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < self.capacity,
            "TbMetadataWriter.read | offset {} out of bounds",
            offset
        );
        self.buffer.read(self.tb_start_offset + offset)
    }
}
