use crate::errors::free_list_error::FreeListError;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct SimpleFreeList {
    sab: SAB,
    start_index: usize,
    bitmap_size: usize,
    slots_start_index: usize,
    sab_head_ptr: usize,
    sab_free_count_ptr: usize,
    sab_bitmap_ptr: usize,
    capacity: usize,
    end_index: usize,
}

impl SimpleFreeList {
    pub fn new(sab: SAB, start_index: usize, capacity: usize) -> Self {
        Self::create(sab, start_index, capacity, false)
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: usize) -> Self {
        Self::create(sab, start_index, capacity, true)
    }

    pub fn calculate_size(capacity: usize) -> usize {
        2 + (capacity + 31) / 32 + capacity
    }

    fn create(sab: SAB, start_index: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity must be positive");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");

        let free_count_slot_index = start_index + 1;
        let bitmap_slot_start_index = start_index + 2;
        let bitmap_size = (capacity + 31) / 32;
        let bitmap_slot_end_index = bitmap_slot_start_index + bitmap_size;
        let slots_start_index = bitmap_slot_end_index;
        let slots_end_index = slots_start_index + capacity;

        assert!(slots_end_index < sab.len(), "SimpleFreeList out of bounds");

        if !bind {
            for i in 0..capacity {
                sab[slots_start_index + i].store((i as i32) + 1, Ordering::Relaxed);
            }

            for i in bitmap_slot_start_index..bitmap_slot_end_index {
                sab[i].store(0, Ordering::Relaxed);
            }

            sab[start_index].store(0, Ordering::Relaxed);
            sab[free_count_slot_index].store(capacity as i32, Ordering::Relaxed);
        }

        SimpleFreeList {
            sab: Arc::clone(&sab),
            start_index,
            sab_head_ptr: start_index,
            sab_free_count_ptr: free_count_slot_index,
            sab_bitmap_ptr: bitmap_slot_start_index,
            slots_start_index,
            bitmap_size,
            end_index: slots_end_index,
            capacity,
        }
    }

    pub fn free_count(&self) -> usize {
        self.sab[self.sab_free_count_ptr].load(Ordering::Relaxed) as usize
    }

    pub fn start_index(&self) -> usize {
        self.start_index
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn alloc(&self) -> Option<usize> {
        let head_index = self.sab[self.sab_head_ptr].load(Ordering::Relaxed);

        if head_index >= self.capacity as i32 {
            return None;
        }

        let next_index =
            self.sab[self.slots_start_index + head_index as usize].load(Ordering::Relaxed);
        let slot_index = head_index as usize;
        self.mark_as_occupied(slot_index);

        self.sab[self.sab_head_ptr].store(next_index, Ordering::Relaxed);
        self.sab[self.sab_free_count_ptr].fetch_sub(1, Ordering::Relaxed);

        Some(slot_index + 1)
    }

    pub fn free(&self, slot_number: usize) -> Result<(), FreeListError> {
        let slot_index = slot_number - 1;
        debug_assert!(slot_index < self.capacity, "slot_number out of bounds");

        if self.is_free(slot_index) {
            return Err(FreeListError::DoubleFree);
        }

        self.trust_free(slot_index);
        self.mark_as_free(slot_index);

        Ok(())
    }

    pub fn copy_from(&mut self, source: &SimpleFreeList) {
        debug_assert!(
            source.capacity <= self.capacity,
            "copy_from source cannot be greater than destination"
        );

        self.sab[self.sab_head_ptr].store(
            source.sab[source.sab_head_ptr].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.sab[self.sab_free_count_ptr].store(
            source.sab[source.sab_free_count_ptr].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );

        for i in 0..source.bitmap_size {
            self.sab[self.sab_bitmap_ptr + i].store(
                source.sab[source.sab_bitmap_ptr + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }

        for i in 0..source.capacity {
            self.sab[self.slots_start_index + i].store(
                source.sab[source.slots_start_index + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }

        if self.capacity > source.capacity {
            for i in source.capacity..self.capacity {
                self.trust_free(i);
            }
        }
    }

    fn is_free(&self, slot_index: usize) -> bool {
        let bitmask = self.sab[self.sab_bitmap_ptr + (slot_index >> 5)].load(Ordering::Relaxed);
        bitmask & (1 << (slot_index & 31)) == 0
    }

    fn mark_as_occupied(&self, slot_index: usize) {
        self.sab[self.sab_bitmap_ptr + (slot_index >> 5)]
            .fetch_or(1 << (slot_index & 31), Ordering::Relaxed);
    }

    fn mark_as_free(&self, slot_index: usize) {
        self.sab[self.sab_bitmap_ptr + (slot_index >> 5)]
            .fetch_and(!(1 << (slot_index & 31)), Ordering::Relaxed);
    }

    fn trust_free(&self, slot_index: usize) {
        debug_assert!(slot_index < self.capacity, "slot_index out of bounds");
        let head_index = self.sab[self.sab_head_ptr].load(Ordering::Relaxed);
        self.sab[self.slots_start_index + slot_index].store(head_index, Ordering::Relaxed);
        self.sab[self.sab_head_ptr].store(slot_index as i32, Ordering::Relaxed);
        self.sab[self.sab_free_count_ptr].fetch_add(1, Ordering::Relaxed);
    }
}
