use std::sync::atomic::Ordering;
use crate::into_array::IntoArray;
use crate::attributes_view::AttributesView;
use crate::primitives::types::SAB;

pub struct AttributePlane<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    end_index: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlane<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        let end_index = start_index + capacity * SLOT_SIZE;

        assert!(end_index < sab.len(), "NodeAttributePlane out of bounds");

        AttributePlane {
            sab,
            start_index,
            end_index,
            capacity,
        }
    }

    pub fn resolve_sab_index(&self, offset: usize) -> usize {
        self.start_index + (offset * SLOT_SIZE)
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn get(&'_ self, offset: usize) -> AttributesView<'_, SLOT_SIZE> {
        debug_assert!(offset < self.capacity, "offset out of bounds");

        AttributesView {
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
}
