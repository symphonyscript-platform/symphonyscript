use crate::primitives::triple_buffer_writer::TripleBufferWriter;

/// Producer-side view into a fixed-size structural block on the triple buffer.
///
/// Provides safe, offset-based read and write access to a specific `[i32; SLOT_SIZE]` sequence.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TripleBufferWriter`.
///
/// # Encapsulation
/// - `write()` is `pub(crate)`: Only the kernel itself can mutate structural topology fields,
///   enforcing strict domain invariants.
/// - Typically instantiated on-the-fly and short-lived.
pub struct SlotWriter<'a, const SLOT_SIZE: usize> {
    triple_buffer: &'a TripleBufferWriter,
    tb_start_offset: usize,
    tb_end_offset: usize,
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
