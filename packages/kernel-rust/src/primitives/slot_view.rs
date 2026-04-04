use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct SlotView<const SLOT_SIZE: usize> {
    sab: SAB,
    sab_start_index: usize,
    capacity: i32,
}

impl<const SLOT_SIZE: usize> SlotView<SLOT_SIZE> {
    pub fn new(sab: SAB, sab_start_index: usize, capacity: i32) -> Self {
        debug_assert!(
            capacity > 0,
            "SlotView::new | capacity {} must be positive",
            capacity
        );
        SlotView {
            sab,
            sab_start_index,
            capacity,
        }
    }

    pub fn bind(sab: SAB, sab_start_index: usize, capacity: i32) -> Self {
        Self::new(sab, sab_start_index, capacity)
    }

    pub fn sab_index(&self, slot_index: usize) -> usize {
        self.sab_start_index + slot_index * SLOT_SIZE
    }

    pub fn get_at(&self, slot_index: usize, offset: usize) -> i32 {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.get_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotView.get_at | offset {} out of bounds",
            offset
        );

        let sab_index = self.sab_start_index + slot_index * SLOT_SIZE + offset;

        self.sab[sab_index].load(Ordering::Relaxed)
    }

    pub fn set_at(&self, slot_index: usize, offset: usize, value: i32) {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.set_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotView.set_at | slot_item_index {} out of bounds",
            offset
        );

        let sab_index = self.sab_start_index + slot_index * SLOT_SIZE + offset;

        self.sab[sab_index].store(value, Ordering::Relaxed)
    }

    pub fn get(&self, slot_index: usize) -> [i32; SLOT_SIZE] {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.get | slot_index {} out of bounds",
            slot_index,
        );

        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];
        let slot_index = self.sab_start_index + slot_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            data[i] = self.sab[slot_index + i].load(Ordering::Relaxed)
        }

        data
    }

    pub fn set(&self, slot_index: usize, data: [i32; SLOT_SIZE]) {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.set | slot_index {} out of bounds",
            slot_index,
        );

        let slot_index = self.sab_start_index + slot_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            self.sab[slot_index + i].store(data[i], Ordering::Relaxed)
        }
    }
}
