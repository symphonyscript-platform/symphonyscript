use crate::primitives::triple_buffer_reader::TripleBufferReader;

/// Consumer-side triple-buffered metadata storage backed by a shared `AtomicBuffer`.
///
/// Provides a flat, power-of-2 sized array of `i32` slots for graph-level configuration
/// and/or statistics. Lives on the `tb` (triple-buffered) plane, meaning
/// writes only become visible after the reader executes a `swap()`.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `TripleBufferReader`.
///
/// # Memory Layout
/// Shares backing region with `TbMetadataWriter`. See its layout.
///
/// # Constraints
/// - Created exclusively via `TbMetadataWriter::to_reader()`.
#[derive(Clone)]
pub struct TbMetadataReader {
    triple_buffer: TripleBufferReader,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl TbMetadataReader {
    pub(crate) fn bind(
        triple_buffer: TripleBufferReader,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        debug_assert!(
            capacity > 0,
            "TbMetadataReader::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "TbMetadataReader::create | capacity {} must be power of 2",
            capacity
        );

        let tb_end_offset = tb_start_offset + capacity;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "TbMetadataReader::create | range [{}..{}] exceeds buffer boundaries",
            tb_start_offset,
            triple_buffer.buffer_capacity()
        );

        TbMetadataReader {
            triple_buffer: triple_buffer,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
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

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < self.capacity,
            "TbMetadataReader.read | offset {} out of bounds",
            offset
        );
        self.triple_buffer.read(self.tb_start_offset + offset)
    }
}
