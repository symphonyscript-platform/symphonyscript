use crate::errors::free_list_error::FreeListError;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

pub struct SimpleFreeList {
    sab: SAB,
    slots_start_index: usize,
    head_slot_index: usize,
    free_count_slot_index: usize,
    bitmap_slot_start_index: usize,
    capacity: i32,
    end_index: usize,
}

impl SimpleFreeList {
    pub fn new(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, false)
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, true)
    }

    fn create(sab: SAB, start_index: usize, capacity: i32, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity cannot be negative");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");

        let free_count_slot_index = start_index + 1;
        let bitmap_slot_start_index = start_index + 2;
        let bitmap_size = (capacity + 31) / 32;
        let bitmap_slot_end_index = bitmap_slot_start_index + bitmap_size as usize;
        let slots_start_index = bitmap_slot_end_index;
        let slots_end_index = slots_start_index + (capacity as usize);

        if !bind {
            for i in 0..capacity {
                sab[slots_start_index + (i as usize)].store(i + 1, Ordering::Relaxed);
            }

            for i in bitmap_slot_start_index..bitmap_slot_end_index {
                sab[i].store(0, Ordering::Relaxed);
            }

            sab[start_index].store(0, Ordering::Relaxed);
            sab[free_count_slot_index].store(capacity, Ordering::Relaxed);
        }

        SimpleFreeList {
            sab: Arc::clone(&sab),
            head_slot_index: start_index,
            free_count_slot_index,
            bitmap_slot_start_index,
            slots_start_index,
            end_index: slots_end_index,
            capacity,
        }
    }

    pub fn free_count(&self) -> i32 {
        self.sab[self.free_count_slot_index].load(Ordering::Relaxed)
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn alloc(&self) -> Option<usize> {
        let head_index = self.sab[self.head_slot_index].load(Ordering::Relaxed);

        if head_index >= self.capacity {
            return None;
        }

        let next_index = self.sab[self.slots_start_index + head_index as usize].load(Ordering::Relaxed);
        let slot_number = head_index as usize;
        self.sab[self.slots_start_index + head_index as usize].store(0, Ordering::Relaxed);
        self.mark_as_occupied(slot_number);

        self.sab[self.head_slot_index].store(next_index, Ordering::Relaxed);
        self.sab[self.free_count_slot_index].fetch_sub(1, Ordering::Relaxed);

        Some(slot_number)
    }

    pub fn free(&self, slot_number: usize) -> Result<(), FreeListError> {
        debug_assert!(
            slot_number < (self.capacity as usize),
            "slot_number out of bounds"
        );

        if self.is_free(slot_number) {
            return Err(FreeListError::DoubleFree);
        }

        let head_index = self.sab[self.head_slot_index].load(Ordering::Relaxed);

        self.sab[self.slots_start_index + slot_number].store(head_index, Ordering::Relaxed);
        self.mark_as_free(slot_number);

        self.sab[self.head_slot_index].store(slot_number as i32, Ordering::Relaxed);
        self.sab[self.free_count_slot_index].fetch_add(1, Ordering::Relaxed);

        Ok(())
    }

    fn is_free(&self, slot_number: usize) -> bool {
        let bitmask = self.sab[self.bitmap_slot_start_index + (slot_number >> 5)].load(Ordering::Relaxed);
        bitmask & (1 << (slot_number & 31)) == 0
    }

    fn mark_as_occupied(&self, slot_number: usize) {
        self.sab[self.bitmap_slot_start_index + (slot_number >> 5)]
            .fetch_or(1 << (slot_number & 31), Ordering::Relaxed);
    }

    fn mark_as_free(&self, slot_number: usize) {
        self.sab[self.bitmap_slot_start_index + (slot_number >> 5)]
            .fetch_and(!(1 << (slot_number & 31)), Ordering::Relaxed);
    }
}
