use crate::primitives::triple_buffer_writer::TripleBufferWriter;

/// Producer-side view into a fixed-size structural block on the triple buffer.
///
/// Provides safe, offset-based read and write access to a specific `[i32; STRIDE]` sequence.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TripleBufferWriter`.
///
/// # Encapsulation
/// - Typically instantiated on-the-fly and short-lived.
pub struct StructWriter<'a, const STRIDE: usize> {
    triple_buffer: &'a TripleBufferWriter,
    tb_start_offset: usize,
    tb_end_offset: usize,
}

impl<'a, const STRIDE: usize> StructWriter<'a, STRIDE> {
    pub fn new(triple_buffer: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + STRIDE;
        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "StructWriter::create | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            STRIDE,
            triple_buffer.buffer_capacity(),
        );
        StructWriter {
            triple_buffer,
            tb_start_offset,
            tb_end_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "StructWriter.read | offset {} out of bounds",
            offset
        );
        self.triple_buffer.read(self.tb_start_offset + offset)
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < STRIDE,
            "StructWriter.write | offset {} out of bounds",
            offset
        );
        self.triple_buffer
            .write(self.tb_start_offset + offset, value)
    }

    pub fn read_all(&self) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }

    pub fn write_all(&self, data: [i32; STRIDE]) {
        for i in 0..STRIDE {
            self.write(i, data[i]);
        }
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }
}
