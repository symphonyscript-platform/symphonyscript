use crate::errors::free_list_error::FreeListError;
use crate::primitives::bitmap::Bitmap;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::staging_buffer::StagingBuffer;
use crate::primitives::types::SAB;
use std::sync::Arc;

#[derive(Clone)]
pub struct SlotAllocator {
    sab_start_index: usize,
    sab_end_index: usize,
    capacity: usize,
    deferred_bitmap: Bitmap,
    free_list: SimpleFreeList,
    deferred_frees_list: StagingBuffer,
}

impl SlotAllocator {
    pub fn new(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        Self::create(sab, sab_start_index, capacity, false)
    }

    pub fn bind(sab: SAB, sab_start_index: usize, capacity: usize) -> Self {
        Self::create(sab, sab_start_index, capacity, true)
    }

    pub fn create(sab: SAB, sab_start_index: usize, capacity: usize, bind: bool) -> Self {
        let bitmap = Bitmap::create(Arc::clone(&sab), sab_start_index, capacity, bind);
        let free_list =
            SimpleFreeList::create(Arc::clone(&sab), bitmap.sab_end_index(), capacity, bind);
        let deferred_frees_list =
            StagingBuffer::create(Arc::clone(&sab), free_list.sab_end_index(), capacity, bind);
        let sab_end_index = deferred_frees_list.sab_end_index();

        debug_assert!(
            sab_end_index <= sab.len(),
            "SlotAllocator::create | range [{}..{}] exceeds SAB boundaries",
            sab_start_index,
            capacity,
        );

        SlotAllocator {
            sab_start_index,
            sab_end_index,
            capacity,
            deferred_bitmap: bitmap,
            free_list,
            deferred_frees_list,
        }
    }

    pub fn calculate_size_on_sab(capacity: usize) -> usize {
        Bitmap::calculate_size_on_sab(capacity)
            + SimpleFreeList::calculate_size_on_sab(capacity)
            + StagingBuffer::calculate_size_on_sab(capacity)
    }

    pub fn free_count(&self) -> usize {
        self.free_list.free_count()
    }

    pub fn deferred_count(&self) -> usize {
        self.deferred_frees_list.len()
    }

    pub fn alloc_count(&self) -> usize {
        self.free_list.alloc_count()
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

    pub fn utilization(&self) -> f32 {
        self.free_list.utilization()
    }

    pub fn is_allocated(&self, slot: usize) -> bool {
        self.free_list.is_allocated(slot)
    }

    pub fn is_active(&self, slot: usize) -> bool {
        self.is_allocated(slot) && !self.is_deferred(slot)
    }

    pub fn is_deferred(&self, slot: usize) -> bool {
        self.deferred_bitmap.is_on(slot - 1)
    }

    pub fn is_free(&self, slot: usize) -> bool {
        self.free_list.is_free(slot)
    }

    pub fn alloc(&self) -> Option<usize> {
        self.free_list.alloc()
    }

    pub fn defer_free(&self, slot_number: usize) -> Result<(), FreeListError> {
        if !self.is_allocated(slot_number) {
            return Err(FreeListError::InvalidSlot);
        }

        let slot_index = slot_number - 1;

        if self.deferred_bitmap.is_on(slot_index) {
            return Err(FreeListError::DoubleFree);
        }

        self.deferred_frees_list.push(slot_number);
        self.deferred_bitmap.on(slot_index);

        Ok(())
    }

    pub fn flush_deferred(&self) {
        for slot in self.deferred_frees_list.drain() {
            self.deferred_bitmap.off(slot - 1);
            let result = self.free_list.free(slot);
            debug_assert!(
                result.is_ok(),
                "SlotAllocator.flush_deferred | internal invariant violated: double free during flush"
            )
        }
    }

    pub fn copy_from(&self, source: &SlotAllocator) {
        debug_assert!(
            source.capacity <= self.capacity,
            "SlotAllocator.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );
        self.deferred_bitmap.copy_from(&source.deferred_bitmap);
        self.free_list.copy_from(&source.free_list);
        self.deferred_frees_list
            .copy_from(&source.deferred_frees_list);
    }
}
