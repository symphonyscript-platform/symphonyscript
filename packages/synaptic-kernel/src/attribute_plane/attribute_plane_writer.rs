use crate::primitives::into_array::IntoArray;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use crate::attribute_plane::attributes_writer::AttributesWriter;

#[derive(Clone)]
pub struct AttributePlaneWriter<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneWriter<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        let mem_end_offset = mem_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            capacity * SLOT_SIZE
        );

        AttributePlaneWriter {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::new(mem, mem_start_offset, capacity)
    }

    pub fn calculate_size(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn resolve_mem_offset(&self, offset: usize) -> usize {
        self.mem_start_offset + (offset * SLOT_SIZE)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&'_ self, offset: usize) -> AttributesWriter<'_, SLOT_SIZE> {
        debug_assert!(
            offset <= self.capacity,
            "AttributePlaneWriter.get | offset {} out of bounds",
            offset,
        );

        AttributesWriter::new(&self.mem, self.resolve_mem_offset(offset))
    }

    pub fn set<T: IntoArray<SLOT_SIZE>>(&self, offset: usize, data: T) {
        debug_assert!(
            offset <= self.capacity,
            "AttributePlaneWriter.set | offset {} out of bounds",
            offset,
        );

        let data = data.to_array();
        let base = self.resolve_mem_offset(offset);

        for i in 0..SLOT_SIZE {
            self.mem[base + i].store(data[i], Ordering::Relaxed);
        }
    }

    pub fn copy_from(&self, source: &AttributePlaneWriter<SLOT_SIZE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "AttributePlaneWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        for i in 0..source.capacity * SLOT_SIZE {
            self.mem[self.mem_start_offset + i].store(
                source.mem[source.mem_start_offset + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }
}
