use crate::primitives::triple_buffer_writer::TripleBufferWriter;

/// Producer-side read-only view into a fixed-size structural block on the triple buffer.
///
/// Provides safe, offset-based read and write access to a specific `[i32; STRIDE]` sequence.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TripleBufferWriter`.
///
/// # Encapsulation
/// - Typically instantiated on-the-fly and short-lived.
pub struct TbZoneView<'a, const STRIDE: usize> {
    tb: &'a TripleBufferWriter,
    tb_start_offset: usize,
}

impl<'a, const STRIDE: usize> TbZoneView<'a, STRIDE> {
    #[inline]
    pub fn new(tb: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + STRIDE;
        debug_assert!(
            tb_end_offset <= tb.buffer_capacity(),
            "TbZoneView::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            STRIDE,
            tb.buffer_capacity(),
        );
        TbZoneView {
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
            "TbZoneWriter.read | offset {} out of bounds",
            offset
        );
        self.tb.read(self.tb_start_offset + offset)
    }

    #[inline]
    pub fn read_all(&self) -> [i32; STRIDE] {
        self.tb.read_batch::<STRIDE>(self.tb_start_offset)
    }
}
