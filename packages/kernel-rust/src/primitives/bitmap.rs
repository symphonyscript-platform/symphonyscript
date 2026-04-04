use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct Bitmap {
    sab: SAB,
    sab_start_index: usize,
    sab_end_index: usize,
    capacity: usize,
    word_count: usize,
}

impl Bitmap {
    pub fn new(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        Self::create(sab, sab_start_index, capacity, false)
    }

    pub fn bind(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        Self::create(sab, sab_start_index, capacity, true)
    }

    pub fn create(sab: SAB, sab_start_index: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity must be positive");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");
        let word_count = Self::calculate_size_on_sab(capacity);
        let sab_end_index = sab_start_index + word_count;

        if !bind {
            for i in sab_start_index..sab_end_index {
                sab[i].store(0, Ordering::Relaxed);
            }
        }

        Bitmap {
            sab,
            sab_start_index,
            sab_end_index,
            capacity,
            word_count,
        }
    }

    pub fn calculate_size_on_sab(capacity: usize) -> usize {
        (capacity + 31) / 32
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn word_count(&self) -> usize {
        self.word_count
    }

    pub fn is_off(&self, bit_offset: usize) -> bool {
        debug_assert!(bit_offset < self.capacity, "is_off: bit_offset out of bounds");
        let bitmask = self.sab[self.sab_start_index + (bit_offset >> 5)].load(Ordering::Relaxed);
        bitmask & (1 << (bit_offset & 31)) == 0
    }

    pub fn is_on(&self, bit_offset: usize) -> bool {
        debug_assert!(bit_offset < self.capacity, "is_on: bit_offset out of bounds");
        !self.is_off(bit_offset)
    }

    pub fn on(&self, bit_offset: usize) {
        debug_assert!(bit_offset < self.capacity, "on: bit_offset out of bounds");
        self.sab[self.sab_start_index + (bit_offset >> 5)]
            .fetch_or(1 << (bit_offset & 31), Ordering::Relaxed);
    }

    pub fn off(&self, bit_offset: usize) {
        debug_assert!(bit_offset < self.capacity, "off: bit_offset out of bounds");
        self.sab[self.sab_start_index + (bit_offset >> 5)]
            .fetch_and(!(1 << (bit_offset & 31)), Ordering::Relaxed);
    }

    pub fn clear(&self) {
        for i in self.sab_start_index..self.sab_end_index {
            self.sab[i].store(0, Ordering::Relaxed);
        }
    }

    pub fn copy_from(&self, source: &Bitmap) {
        for i in 0..source.word_count {
            self.sab[self.sab_start_index + i].store(
                source.sab[source.sab_start_index + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }
}
