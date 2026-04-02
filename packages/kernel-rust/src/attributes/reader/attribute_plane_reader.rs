use crate::attributes::reader::attributes_reader::AttributesReader;
use crate::primitives::types::SAB;

#[derive(Clone)]
pub struct AttributePlaneReader<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    end_index: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneReader<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        let end_index = start_index + capacity * SLOT_SIZE;

        debug_assert!(end_index <= sab.len(), "AttributePlaneReader out of bounds");

        AttributePlaneReader {
            sab,
            start_index,
            end_index,
            capacity,
        }
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: usize) -> Self {
        Self::new(sab, start_index, capacity)
    }

    pub fn calculate_size(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn resolve_sab_index(&self, offset: usize) -> usize {
        self.start_index + (offset * SLOT_SIZE)
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn get(&'_ self, offset: usize) -> AttributesReader<'_, SLOT_SIZE> {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        AttributesReader {
            sab: &self.sab,
            start_index: self.resolve_sab_index(offset),
        }
    }
}
