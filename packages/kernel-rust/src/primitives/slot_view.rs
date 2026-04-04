use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct SlotView<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    capacity: i32,
}

impl<const SLOT_SIZE: usize> SlotView<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: i32) -> Self {
        debug_assert!(
            capacity > 0,
            "SlotView::new | capacity {} cannot be negative",
            capacity
        );
        SlotView {
            sab,
            start_index,
            capacity,
        }
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::new(sab, start_index, capacity)
    }

    pub fn sab_index(&self, slot_index: usize) -> usize {
        self.start_index + slot_index * SLOT_SIZE
    }

    pub fn get_at(&self, slot_index: usize, slot_item_index: usize) -> i32 {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.get_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            slot_item_index < SLOT_SIZE,
            "SlotView.get_at | slot_item_index {} out of bounds",
            slot_item_index
        );

        let sab_index = self.start_index + slot_index * SLOT_SIZE + slot_item_index;

        self.sab[sab_index].load(Ordering::Relaxed)
    }

    pub fn set_at(&self, slot_index: usize, slot_item_index: usize, value: i32) {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.set_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            slot_item_index < SLOT_SIZE,
            "SlotView.set_at | slot_item_index {} out of bounds",
            slot_item_index
        );

        let sab_index = self.start_index + slot_index * SLOT_SIZE + slot_item_index;

        self.sab[sab_index].store(value, Ordering::Relaxed)
    }

    pub fn get(&self, index: usize) -> [i32; SLOT_SIZE] {
        debug_assert!(
            index < self.capacity as usize,
            "SlotView.get | index {} out of bounds",
            index,
        );

        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];
        let slot_index = self.start_index + index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            data[i] = self.sab[slot_index + i].load(Ordering::Relaxed)
        }

        data
    }

    pub fn set(&self, index: usize, data: [i32; SLOT_SIZE]) {
        debug_assert!(
            index < self.capacity as usize,
            "SlotView.set | index {} out of bounds",
            index,
        );

        let slot_index = self.start_index + index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            self.sab[slot_index + i].store(data[i], Ordering::Relaxed)
        }
    }
}
