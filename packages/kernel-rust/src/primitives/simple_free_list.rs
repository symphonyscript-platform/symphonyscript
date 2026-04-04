use crate::errors::free_list_error::FreeListError;
use crate::primitives::bitmap::Bitmap;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct SimpleFreeList {
    sab: SAB,
    start_index: usize,
    alloc_bitmap: Bitmap,
    slots_start_index: usize,
    sab_head_ptr: usize,
    sab_free_count_ptr: usize,
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

    pub fn create(sab: SAB, start_index: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(
            capacity > 0,
            "SimpleFreeList::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "SimpleFreeList::create | capacity {} must be power of 2",
            capacity
        );

        let free_count_slot_index = start_index + 1;
        let alloc_bitmap = Bitmap::create(Arc::clone(&sab), start_index + 2, capacity, bind);
        let slots_start_index = alloc_bitmap.sab_end_index();
        let slots_end_index = slots_start_index + capacity;

        assert!(slots_end_index <= sab.len(), "SimpleFreeList out of bounds");

        if !bind {
            for i in 0..capacity {
                sab[slots_start_index + i].store((i as i32) + 1, Ordering::Relaxed);
            }

            sab[start_index].store(0, Ordering::Relaxed);
            sab[free_count_slot_index].store(capacity as i32, Ordering::Relaxed);
        }

        SimpleFreeList {
            sab: Arc::clone(&sab),
            start_index,
            alloc_bitmap,
            sab_head_ptr: start_index,
            sab_free_count_ptr: free_count_slot_index,
            slots_start_index,
            end_index: slots_end_index,
            capacity,
        }
    }

    pub fn calculate_size_on_sab(capacity: usize) -> usize {
        2 + Bitmap::calculate_size_on_sab(capacity) + capacity
    }

    pub fn free_count(&self) -> usize {
        self.sab[self.sab_free_count_ptr].load(Ordering::Relaxed) as usize
    }

    pub fn alloc_count(&self) -> usize {
        self.capacity - self.free_count()
    }

    pub fn sab_start_index(&self) -> usize {
        self.start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.end_index
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn utilization(&self) -> f32 {
        self.alloc_count() as f32 / self.capacity as f32
    }

    pub fn is_allocated(&self, slot: usize) -> bool {
        self.alloc_bitmap.is_on(slot - 1)
    }

    pub fn is_free(&self, slot: usize) -> bool {
        self.alloc_bitmap.is_off(slot - 1)
    }

    pub fn alloc(&self) -> Option<usize> {
        let head_index = self.sab[self.sab_head_ptr].load(Ordering::Relaxed);

        if head_index >= self.capacity as i32 {
            return None;
        }

        let slot_index = head_index as usize;
        let next_index =
            self.sab[self.slots_start_index + head_index as usize].load(Ordering::Relaxed);
        self.sab[self.sab_head_ptr].store(next_index, Ordering::Relaxed);
        self.sab[self.sab_free_count_ptr].fetch_sub(1, Ordering::Relaxed);

        self.alloc_bitmap.on(slot_index);

        Some(slot_index + 1)
    }

    pub fn free(&self, slot_number: usize) -> Result<(), FreeListError> {
        let slot_index = slot_number - 1;
        debug_assert!(
            slot_index < self.capacity,
            "SimpleFreeList.free | slot_number {} out of bounds",
            slot_number
        );

        if self.alloc_bitmap.is_off(slot_index) {
            return Err(FreeListError::DoubleFree);
        }

        self.trust_free(slot_index);
        self.alloc_bitmap.off(slot_index);

        Ok(())
    }

    pub fn copy_from(&self, source: &SimpleFreeList) {
        debug_assert!(
            source.capacity <= self.capacity,
            "SimpleFreeList.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.sab[self.sab_head_ptr].store(
            source.sab[source.sab_head_ptr].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.sab[self.sab_free_count_ptr].store(
            source.sab[source.sab_free_count_ptr].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );

        self.alloc_bitmap.copy_from(&source.alloc_bitmap);

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

    fn trust_free(&self, slot_index: usize) {
        debug_assert!(
            slot_index < self.capacity,
            "SimpleFreeList.trust_free | slot_index {} out of bounds",
            slot_index
        );
        let head_index = self.sab[self.sab_head_ptr].load(Ordering::Relaxed);
        self.sab[self.slots_start_index + slot_index].store(head_index, Ordering::Relaxed);
        self.sab[self.sab_head_ptr].store(slot_index as i32, Ordering::Relaxed);
        self.sab[self.sab_free_count_ptr].fetch_add(1, Ordering::Relaxed);
    }
}
