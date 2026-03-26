use std::sync::atomic::Ordering;
use crate::primitives::types::SAB;

pub struct RingView<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    capacity: i32,
}

impl<const SLOT_SIZE: usize> RingView<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: i32) -> Self {
        assert!(capacity > 0, "capacity cannot be negative");
        RingView {
            sab,
            start_index,
            capacity,
        }
    }

    pub fn get(&self, index: usize) -> [i32; SLOT_SIZE] {
        assert!(index < self.capacity as usize, "ring slot index out of bounds");

        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];
        let slot_index = self.start_index + index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            data[i] = self.sab[slot_index + i].load(Ordering::Relaxed)
        }

        data
    }

    pub fn set(&self, index: usize, data: [i32; SLOT_SIZE]) {
        assert!(index < self.capacity as usize, "ring slot index out of bounds");

        let slot_index = self.start_index + index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            self.sab[slot_index + i].store(data[i], Ordering::Relaxed)
        }
    }
}
