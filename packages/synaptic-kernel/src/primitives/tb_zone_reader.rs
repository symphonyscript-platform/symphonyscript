use crate::primitives::triple_buffer_reader::TripleBufferReader;

/// Consumer-side view into a fixed-size structural block on the triple buffer.
///
/// Provides safe, offset-based read-only access to a specific `[i32; STRIDE]` sequence.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `TripleBufferReader`.
///
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
/// - Typically instantiated on-the-fly and short-lived.
pub struct TbZoneReader<'a, const STRIDE: usize> {
    tb: &'a TripleBufferReader,
    tb_start_offset: usize,
}

impl<'a, const STRIDE: usize> TbZoneReader<'a, STRIDE> {
    #[inline]
    pub fn new(tb: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + STRIDE;
        debug_assert!(
            tb_end_offset <= tb.buffer_capacity(),
            "TbZoneReader::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            STRIDE,
            tb.buffer_capacity(),
        );
        TbZoneReader {
            tb,
            tb_start_offset,
        }
    }

    #[inline]
    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    #[inline]
    pub fn tb_end_offset(&self) -> usize {
        self.tb_start_offset + STRIDE
    }

    #[inline]
    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "TbZoneReader.read | offset {} out of bounds",
            offset
        );
        self.tb.read(self.tb_start_offset + offset)
    }

    #[inline]
    pub fn read_all(&self) -> [i32; STRIDE] {
        self.tb.read_batch::<STRIDE>(self.tb_start_offset)
    }
}
