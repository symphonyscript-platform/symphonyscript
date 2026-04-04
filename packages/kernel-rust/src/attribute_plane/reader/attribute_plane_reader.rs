use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::primitives::types::AtomicBuffer;

#[derive(Clone)]
pub struct AttributePlaneReader<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneReader<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        let mem_end_offset = mem_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneReader::new | range [{}..{}] exceeds MEM boundaries",
            mem_start_offset,
            capacity * SLOT_SIZE,
        );

        AttributePlaneReader {
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

    pub fn get(&'_ self, offset: usize) -> AttributesReader<'_, SLOT_SIZE> {
        debug_assert!(
            offset < self.capacity,
            "AttributePlaneReader.get | offset {} out of bounds",
            offset
        );

        AttributesReader::new(&self.mem, self.resolve_mem_offset(offset))
    }
}
