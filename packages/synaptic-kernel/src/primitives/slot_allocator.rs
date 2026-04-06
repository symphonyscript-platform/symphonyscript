use crate::errors::free_list_error::FreeListError;
use crate::primitives::bitmap::Bitmap;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::staging_buffer::StagingBuffer;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

#[derive(Clone)]
pub struct SlotAllocator {
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
    staging_bitmap: Bitmap,
    free_list: SimpleFreeList,
    staging_buffer: StagingBuffer,
}

/**
 * SPSC Slot Allocator
 */
impl SlotAllocator {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize, bind: bool) -> Self {
        let bitmap = Bitmap::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let free_list =
            SimpleFreeList::create(Arc::clone(&mem), bitmap.mem_end_offset(), capacity, bind);
        let deferred_frees_list =
            StagingBuffer::create(Arc::clone(&mem), free_list.mem_end_offset(), capacity, bind);
        let mem_end_offset = deferred_frees_list.mem_end_offset();

        debug_assert!(
            mem_end_offset <= mem.len(),
            "SlotAllocator::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            capacity,
        );

        SlotAllocator {
            mem_start_offset,
            mem_end_offset,
            capacity,
            staging_bitmap: bitmap,
            free_list,
            staging_buffer: deferred_frees_list,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        Bitmap::calculate_size_on_mem(capacity)
            + SimpleFreeList::calculate_size_on_mem(capacity)
            + StagingBuffer::calculate_size_on_mem(capacity)
    }

    pub fn free_count(&self) -> usize {
        self.free_list.free_count()
    }

    pub fn deferred_count(&self) -> usize {
        self.staging_buffer.len()
    }

    pub fn alloc_count(&self) -> usize {
        self.free_list.alloc_count()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn mem_staging_buffer_start_offset(&self) -> usize {
        self.staging_buffer.mem_start_offset()
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
        self.staging_bitmap.is_on(slot - 1)
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

        if self.staging_bitmap.is_on(slot_index) {
            return Err(FreeListError::DoubleFree);
        }

        self.staging_buffer.push(slot_number);
        self.staging_bitmap.on(slot_index);

        Ok(())
    }

    pub fn publish(&self) {
        for slot in self.staging_buffer.drain() {
            self.staging_bitmap.off(slot - 1);
            let result = self.free_list.free(slot);
            debug_assert!(
                result.is_ok(),
                "SlotAllocator.flush_deferred | internal invariant violated: double free during flush"
            )
        }

        self.staging_buffer.publish()
    }

    pub fn copy_from(&self, source: &SlotAllocator) {
        debug_assert!(
            source.capacity <= self.capacity,
            "SlotAllocator.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );
        self.staging_bitmap.copy_from(&source.staging_bitmap);
        self.free_list.copy_from(&source.free_list);
        self.staging_buffer.copy_from(&source.staging_buffer);
    }
}
