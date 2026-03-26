use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct SlotHandle<const SLOT_SIZE: usize> {
    sab: SAB,
    pub(crate) start_index: usize,
}

impl<const SLOT_SIZE: usize> SlotHandle<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize) -> Self {
        SlotHandle { sab, start_index }
    }

    pub fn read(&self, index: usize) -> i32 {
        debug_assert!(index < SLOT_SIZE, "slot handle index out of bounds");
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    pub fn read_all(&self) -> [i32; SLOT_SIZE] {
        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];

        for i in 0..SLOT_SIZE {
            data[i] = self.sab[self.start_index + i].load(Ordering::Relaxed);
        }

        data
    }
    pub fn write(&self, index: usize, value: i32) {
        debug_assert!(index < SLOT_SIZE, "slot handle index out of bounds");
        self.sab[self.start_index + index].store(value, Ordering::Relaxed);
    }

    pub fn write_all(&self, data: [i32; SLOT_SIZE]) {
        for i in 0..SLOT_SIZE {
            self.sab[self.start_index + i].store(data[i], Ordering::Relaxed);
        }
    }
}
