use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Reader side global metadata storage backed by a shared `AtomicBuffer`.
///
/// Provides read-only access to a flat, power-of-2 sized array of `i32` slots
/// for graph-level configuration and/or statistics.
/// Lives on the `mem` (direct) plane (non-triple-buffered), meaning
/// writer updates are immediately visible without requiring a `swap()`.
///
/// # Threading
/// Consumer thread only. All atomic operations use `Relaxed` ordering.
///
/// # Memory Layout
/// Shares backing region with `MemMetadataWriter`. See its layout.
///
/// # Constraints
/// - Created exclusively via `MemMetadataWriter::to_reader()`.
#[derive(Clone)]
pub struct MemMetadataReader {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl MemMetadataReader {
    pub(crate) fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        debug_assert!(
            capacity > 0,
            "MemMetadataReader::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "MemMetadataReader::create | capacity {} must be power of 2",
            capacity
        );

        let mem_end_offset = mem_start_offset + capacity;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemMetadataReader::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            mem.len()
        );

        MemMetadataReader {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < self.capacity,
            "MemMetadataReader.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }
}
