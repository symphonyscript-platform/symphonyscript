use std::sync::atomic::Ordering;
use crate::primitives::free_list::FreeList;
use crate::primitives::types::SAB;

pub struct NodeAllocator<const SLOT_SIZE: usize> {
    sab: SAB,
    free_list: FreeList<SLOT_SIZE>,
    base_a: usize,
    base_b: usize,
    active_index: usize,
    end_index: usize,
}

impl<const SLOT_SIZE: usize> NodeAllocator<SLOT_SIZE> {
    pub fn new(
        sab: SAB,
        free_list: FreeList<SLOT_SIZE>,
        start_index: usize,
        capacity: i32,
    ) -> Self {
        Self::create(sab, free_list, start_index, capacity, false)
    }

    pub fn bind(
        sab: SAB,
        free_list: FreeList<SLOT_SIZE>,
        start_index: usize,
        capacity: i32,
    ) -> Self {
        Self::create(sab, free_list, start_index, capacity, true)
    }

    fn create(
        sab: SAB,
        free_list: FreeList<SLOT_SIZE>,
        start_index: usize,
        capacity: i32,
        bind: bool,
    ) -> Self {
        debug_assert_eq!(
            free_list.capacity() * SLOT_SIZE as i32,
            capacity,
            "free_list capacity does not match the allocator"
        );
        let active_index = start_index;
        let base_a = start_index + 1;
        let base_b = base_a + capacity as usize;
        let end_index = base_b + capacity as usize;

        if !bind {
            for i in start_index..end_index {
                sab[i].store(0, Ordering::Relaxed);
            }
        }

        NodeAllocator {
            sab,
            free_list,
            base_a,
            base_b,
            active_index,
            end_index,
        }
    }
}

