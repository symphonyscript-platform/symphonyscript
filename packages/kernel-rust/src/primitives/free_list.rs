use crate::errors::free_list_error::FreeListError;
use crate::primitives::slot_handle::SlotHandle;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct FreeList<const SLOT_SIZE: usize> {
    sab: SAB,
    start_index: usize,
    head_slot_index: usize,
    free_count_slot_index: usize,
    bitmap_slot_start_index: usize,
    capacity: i32,
    end_index: usize,
}

impl<const SLOT_SIZE: usize> FreeList<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, false)
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, true)
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    fn create(sab: SAB, start_index: usize, capacity: i32, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity cannot be negative");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");

        let bitmap_size = (capacity + 31) / 32;
        let bitmap_slot_start_index = start_index + 3;
        let bitmap_slot_end_index = bitmap_slot_start_index + bitmap_size as usize;
        let slots_start_index = bitmap_slot_end_index;
        let slots_end_index = slots_start_index + (capacity as usize) * SLOT_SIZE;
        let free_count_slot_index = start_index + 1;

        if !bind {
            for i in 0..capacity {
                sab[slots_start_index + (i as usize * SLOT_SIZE)].store(i + 1, Ordering::Relaxed);
            }

            for i in bitmap_slot_start_index..bitmap_slot_end_index {
                sab[i].store(0, Ordering::Relaxed);
            }

            sab[start_index].store(0, Ordering::Relaxed);
            sab[free_count_slot_index].store(capacity, Ordering::Relaxed);
        }

        FreeList {
            sab: Arc::clone(&sab),
            head_slot_index: start_index,
            free_count_slot_index,
            bitmap_slot_start_index,
            start_index: slots_start_index,
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

    pub fn alloc(&'_ self) -> Option<SlotHandle<'_, SLOT_SIZE>> {
        let head_index = self.sab[self.head_slot_index].load(Ordering::Relaxed);

        if head_index >= self.capacity {
            return None;
        }

        let slot = SlotHandle::<SLOT_SIZE>::new(
            &self.sab,
            self.start_index + (head_index as usize) * SLOT_SIZE,
        );
        let next_index = slot.read(0);
        slot.write_all([0; SLOT_SIZE]);
        self.mark_as_occupied(&slot);

        self.sab[self.head_slot_index].store(next_index, Ordering::Relaxed);
        self.sab[self.free_count_slot_index].fetch_sub(1, Ordering::Relaxed);

        Some(slot)
    }

    pub fn free(&self, slot: SlotHandle<SLOT_SIZE>) -> Result<(), FreeListError> {
        if self.is_free(&slot) {
            return Err(FreeListError::DoubleFree);
        }

        let head_index = self.sab[self.head_slot_index].load(Ordering::Relaxed);

        slot.write(0, head_index);
        self.mark_as_free(&slot);

        let new_head_index = (slot.start_index - self.start_index) / SLOT_SIZE;
        self.sab[self.head_slot_index].store(new_head_index as i32, Ordering::Relaxed);
        self.sab[self.free_count_slot_index].fetch_add(1, Ordering::Relaxed);

        Ok(())
    }

    fn is_free(&self, slot: &SlotHandle<SLOT_SIZE>) -> bool {
        let slot_index = (slot.start_index - self.start_index) / SLOT_SIZE;
        let bitmask =
            self.sab[self.bitmap_slot_start_index + (slot_index >> 5)].load(Ordering::Relaxed);
        bitmask & (1 << (slot_index & 31)) == 0
    }

    fn mark_as_occupied(&self, slot: &SlotHandle<SLOT_SIZE>) {
        let slot_index = (slot.start_index - self.start_index) / SLOT_SIZE;
        self.sab[self.bitmap_slot_start_index + (slot_index >> 5)]
            .fetch_or(1 << (slot_index & 31), Ordering::Relaxed);
    }

    fn mark_as_free(&self, slot: &SlotHandle<SLOT_SIZE>) {
        let slot_index = (slot.start_index - self.start_index) / SLOT_SIZE;
        self.sab[self.bitmap_slot_start_index + (slot_index >> 5)]
            .fetch_and(!(1 << (slot_index & 31)), Ordering::Relaxed);
    }
}
