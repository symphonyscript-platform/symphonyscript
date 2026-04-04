use crate::attribute_plane::reader::attributes_reader::AttributesReader;
use crate::primitives::types::SAB;

#[derive(Clone)]
pub struct AttributePlaneReader<const SLOT_SIZE: usize> {
    sab: SAB,
    sab_start_index: usize,
    sab_end_index: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneReader<SLOT_SIZE> {
    pub fn new(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        let sab_end_index = sab_start_index + capacity * SLOT_SIZE;

        debug_assert!(
            sab_end_index <= sab.len(),
            "AttributePlaneReader::new | range [{}..{}] exceeds SAB boundaries",
            sab_start_index,
            capacity * SLOT_SIZE,
        );

        AttributePlaneReader {
            sab,
            sab_start_index,
            sab_end_index,
            capacity,
        }
    }

    pub fn bind(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        Self::new(sab, sab_start_index, capacity)
    }

    pub fn calculate_size(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn resolve_sab_index(&self, offset: usize) -> usize {
        self.sab_start_index + (offset * SLOT_SIZE)
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn get(&'_ self, offset: usize) -> AttributesReader<'_, SLOT_SIZE> {
        debug_assert!(
            offset < self.capacity,
            "AttributePlaneReader.get | offset {} out of bounds",
            offset
        );

        AttributesReader::new(&self.sab, self.resolve_sab_index(offset))
    }
}
