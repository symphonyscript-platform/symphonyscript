use crate::attribute_plane::attribute_plane_writer::AttributePlaneWriter;
use crate::attribute_plane::attributes_reader::AttributesReader;
use crate::primitives::types::AtomicBuffer;

#[derive(Clone)]
pub struct AttributePlaneReader<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneReader<SLOT_SIZE> {
    pub(crate) fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        let mem_end_offset = mem_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneReader::bind | range [{}..{}] exceeds AtomicBuffer boundaries",
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

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&'_ self, slot: usize) -> AttributesReader<'_, SLOT_SIZE> {
        let mem_offset =
            AttributePlaneWriter::<SLOT_SIZE>::resolve_mem_offset(self.mem_start_offset, slot);

        debug_assert!(
            mem_offset + SLOT_SIZE <= self.mem_end_offset,
            "AttributePlaneReader.get | slot {} out of bounds",
            slot,
        );

        AttributesReader::new(&self.mem, mem_offset)
    }
}
