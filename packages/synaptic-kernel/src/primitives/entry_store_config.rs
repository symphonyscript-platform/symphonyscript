use crate::primitives::slot_allocator::SlotAllocator;

#[derive(Clone, Copy)]
pub struct EntryStoreConfig {
    pub core_stride: usize,
    pub meta_stride: usize,
    pub attr_stride: usize,
    pub capacity: usize,
}

impl EntryStoreConfig {
    pub fn size_on_mem(&self) -> usize {
        SlotAllocator::calculate_size_on_mem(self.capacity) + self.capacity * self.attr_stride
    }

    pub fn size_on_tb(&self) -> usize {
        self.capacity * (self.core_stride + self.meta_stride)
    }
}
