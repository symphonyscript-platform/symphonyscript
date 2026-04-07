use crate::metadata::mem_metadata_reader::MemMetadataReader;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct MemMetadataWriter {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl MemMetadataWriter {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(
            capacity > 0,
            "MemMetadataWriter::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "MemMetadataWriter::create | capacity {} must be power of 2",
            capacity
        );

        let mem_end_offset = mem_start_offset + capacity;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemMetadataWriter::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            mem.len()
        );

        if !bind {
            for i in 0..capacity {
                mem[mem_start_offset + i].store(0, Ordering::Relaxed);
            }
        }

        MemMetadataWriter {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        capacity
    }

    pub fn to_reader(&self) -> MemMetadataReader {
        MemMetadataReader::bind(Arc::clone(&self.mem), self.mem_start_offset, self.capacity)
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

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < self.capacity,
            "MemMetadataWriter.write | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].store(value, Ordering::Relaxed)
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < self.capacity,
            "MemMetadataWriter.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    pub fn copy_from(&self, source: &MemMetadataWriter) {
        debug_assert!(
            source.capacity <= self.capacity,
            "MemMetadataWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        for i in 0..source.capacity {
            self.write(i, source.read(i));
        }
    }
}
