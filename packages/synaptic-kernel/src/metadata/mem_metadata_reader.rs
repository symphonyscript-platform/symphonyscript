use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

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
