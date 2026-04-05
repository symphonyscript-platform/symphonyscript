use crate::errors::free_list_error::FreeListError;
use crate::primitives::slot_handle::SlotHandle;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct FreeList<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    head_slot_index: usize,
    free_count_slot_index: usize,
    bitmap_slot_start_index: usize,
    capacity: i32,
    mem_end_offset: usize,
}

impl<const SLOT_SIZE: usize> FreeList<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32, bind: bool) -> Self {
        debug_assert!(
            capacity > 0,
            "FreeList::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "FreeList::create | capacity {} must be power of 2",
            capacity
        );

        let bitmap_size = (capacity + 31) / 32;
        let bitmap_slot_start_index = mem_start_offset + 3;
        let bitmap_slot_end_index = bitmap_slot_start_index + bitmap_size as usize;
        let slots_start_index = bitmap_slot_end_index;
        let slots_end_index = slots_start_index + (capacity as usize) * SLOT_SIZE;
        let free_count_slot_index = mem_start_offset + 1;

        if !bind {
            for i in 0..capacity {
                mem[slots_start_index + (i as usize * SLOT_SIZE)].store(i + 1, Ordering::Relaxed);
            }

            for i in bitmap_slot_start_index..bitmap_slot_end_index {
                mem[i].store(0, Ordering::Relaxed);
            }

            mem[mem_start_offset].store(0, Ordering::Relaxed);
            mem[free_count_slot_index].store(capacity, Ordering::Relaxed);
        }

        FreeList {
            mem: Arc::clone(&mem),
            head_slot_index: mem_start_offset,
            free_count_slot_index,
            bitmap_slot_start_index,
            mem_start_offset: slots_start_index,
            mem_end_offset: slots_end_index,
            capacity,
        }
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    pub fn free_count(&self) -> i32 {
        self.mem[self.free_count_slot_index].load(Ordering::Relaxed)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn alloc(&'_ self) -> Option<SlotHandle<'_, SLOT_SIZE>> {
        let head_index = self.mem[self.head_slot_index].load(Ordering::Relaxed);

        if head_index >= self.capacity {
            return None;
        }

        let slot = SlotHandle::<SLOT_SIZE>::new(
            &self.mem,
            self.mem_start_offset + (head_index as usize) * SLOT_SIZE,
        );
        let next_index = slot.read(0);
        slot.write_all([0; SLOT_SIZE]);
        self.mark_as_occupied(&slot);

        self.mem[self.head_slot_index].store(next_index, Ordering::Relaxed);
        self.mem[self.free_count_slot_index].fetch_sub(1, Ordering::Relaxed);

        Some(slot)
    }

    pub fn free(&self, slot: SlotHandle<SLOT_SIZE>) -> Result<(), FreeListError> {
        if self.is_free(&slot) {
            return Err(FreeListError::DoubleFree);
        }

        let head_index = self.mem[self.head_slot_index].load(Ordering::Relaxed);

        slot.write(0, head_index);
        self.mark_as_free(&slot);

        let new_head_index = (slot.mem_start_offset - self.mem_start_offset) / SLOT_SIZE;
        self.mem[self.head_slot_index].store(new_head_index as i32, Ordering::Relaxed);
        self.mem[self.free_count_slot_index].fetch_add(1, Ordering::Relaxed);

        Ok(())
    }

    fn is_free(&self, slot: &SlotHandle<SLOT_SIZE>) -> bool {
        let slot_index = (slot.mem_start_offset - self.mem_start_offset) / SLOT_SIZE;
        let bitmask =
            self.mem[self.bitmap_slot_start_index + (slot_index >> 5)].load(Ordering::Relaxed);
        bitmask & (1 << (slot_index & 31)) == 0
    }

    fn mark_as_occupied(&self, slot: &SlotHandle<SLOT_SIZE>) {
        let slot_index = (slot.mem_start_offset - self.mem_start_offset) / SLOT_SIZE;
        self.mem[self.bitmap_slot_start_index + (slot_index >> 5)]
            .fetch_or(1 << (slot_index & 31), Ordering::Relaxed);
    }

    fn mark_as_free(&self, slot: &SlotHandle<SLOT_SIZE>) {
        let slot_index = (slot.mem_start_offset - self.mem_start_offset) / SLOT_SIZE;
        self.mem[self.bitmap_slot_start_index + (slot_index >> 5)]
            .fetch_and(!(1 << (slot_index & 31)), Ordering::Relaxed);
    }
}
