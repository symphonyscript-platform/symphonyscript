use crate::metadata::tb_metadata_reader::TbMetadataReader;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;

/// Producer-side triple-buffered metadata storage backed by a shared `AtomicBuffer`.
///
/// Provides a flat, power-of-2 sized array of `i32` slots for graph-level configuration
/// and/or statistics. Lives on the `tb` (triple-buffered) plane, meaning
/// writes only become visible to the reader after a `publish()`.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TripleBufferWriter`.
///
/// # Memory Layout
/// ```text
/// Offset      Size        Field
/// -------------------------------------
/// 0           N           metadat_region
///
/// N = capacity (power of 2)
/// ```
///
/// # Constraints
/// - 0-based offset indexing.
/// - Use `to_reader()` to create the paired `TbMetadataReader`.
#[derive(Clone)]
pub struct TbMetadataWriter {
    triple_buffer: TripleBufferWriter,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl TbMetadataWriter {
    pub fn new(triple_buffer: TripleBufferWriter, tb_start_offset: usize, capacity: usize) -> Self {
        Self::create(triple_buffer, tb_start_offset, capacity, false)
    }

    pub fn bind(
        triple_buffer: TripleBufferWriter,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(triple_buffer, tb_start_offset, capacity, true)
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
            triple_buffer: buffer,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    #[inline]
    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity
    }

    pub fn to_reader(&self) -> TbMetadataReader {
        TbMetadataReader::bind(
            self.triple_buffer.to_reader(),
            self.tb_start_offset,
            self.capacity,
        )
    }

    #[inline]
    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    #[inline]
    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    #[inline]
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    #[inline]
    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < self.capacity,
            "TbMetadataWriter.write | offset {} out of bounds",
            offset
        );
        self.triple_buffer
            .write(self.tb_start_offset + offset, value);
    }

    #[inline]
    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < self.capacity,
            "TbMetadataWriter.read | offset {} out of bounds",
            offset
        );
        self.triple_buffer.read(self.tb_start_offset + offset)
    }

    pub fn copy_from(&self, source: &TbMetadataWriter) {
        debug_assert!(
            source.capacity <= self.capacity,
            "TbMetadataWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.triple_buffer.copy_region_from(
            &source.triple_buffer,
            source.tb_start_offset,
            self.tb_start_offset,
            Self::calculate_size_on_tb(source.capacity),
        );
    }
}
