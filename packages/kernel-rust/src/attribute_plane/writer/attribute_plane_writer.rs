use crate::attribute_plane::writer::attributes_writer::AttributesWriter;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct AttributePlaneWriter<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    end_index: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneWriter<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        let end_index = start_index + capacity * SLOT_SIZE;

        debug_assert!(end_index <= sab.len(), "AttributePlaneWriter out of bounds");

        AttributePlaneWriter {
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

    pub fn sab_end_index(&self) -> usize {
        self.end_index
    }

    pub fn get(&'_ self, offset: usize) -> AttributesWriter<'_, SLOT_SIZE> {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        AttributesWriter {
            sab: &self.sab,
            start_index: self.resolve_sab_index(offset),
        }
    }

    pub fn set<T: IntoArray<SLOT_SIZE>>(&self, offset: usize, data: T) {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        let data = data.to_array();
        let base = self.resolve_sab_index(offset);

        for i in 0..SLOT_SIZE {
            self.sab[base + i].store(data[i], Ordering::Relaxed);
        }
    }

    pub fn copy_from(&self, source: &AttributePlaneWriter<SLOT_SIZE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "copy_from source cannot be greater than destination"
        );

        for i in 0..source.capacity * SLOT_SIZE {
            self.sab[self.start_index + i].store(
                source.sab[source.start_index + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }
}
