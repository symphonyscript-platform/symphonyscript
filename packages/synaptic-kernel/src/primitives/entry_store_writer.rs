use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::entry_handle::EntryHandle;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::primitives::entry_writer::EntryWriter;
use crate::primitives::mem_zone_writer::MemZoneWriter;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::tb_zone_view::TbZoneView;
use crate::primitives::tb_zone_writer::TbZoneWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct EntryStoreWriter<
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    mem: AtomicBuffer,
    tb: TripleBufferWriter,
    allocator: SlotAllocator,
    mem_start_offset: usize,
    mem_attrs_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}
impl<const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    EntryStoreWriter<CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(mem, tb, mem_start_offset, tb_start_offset, capacity, false)
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(mem, tb, mem_start_offset, tb_start_offset, capacity, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        tb: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        let mem_end_offset = mem_start_offset + SlotAllocator::calculate_size_on_mem(capacity);

        debug_assert!(
            mem_end_offset <= mem.len(),
            "EntryStoreWriter::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            mem.len(),
        );

        let allocator = SlotAllocator::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let mem_attrs_start_offset = allocator.mem_end_offset();
        let mem_end_offset = mem_attrs_start_offset + capacity * ATTR_STRIDE;
        let tb_end_offset = tb_start_offset + Self::calculate_size_on_tb(capacity);

        EntryStoreWriter {
            mem,
            tb,
            allocator,
            mem_start_offset,
            mem_attrs_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        SlotAllocator::calculate_size_on_mem(capacity) + capacity * ATTR_STRIDE
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity * (CORE_STRIDE + META_STRIDE)
    }

    #[inline]
    pub(crate) fn calculate_struct_zone_base(tb_start_offset: usize, slot: usize) -> usize {
        debug_assert!(
            slot > 0,
            "EntryStoreWriter::calculate_struct_zone_base | slot {} out of bounds",
            slot
        );
        tb_start_offset + (slot - 1) * (CORE_STRIDE + META_STRIDE)
    }

    #[inline]
    pub(crate) fn calculate_attr_zone_base(mem_attrs_start_offset: usize, slot: usize) -> usize {
        debug_assert!(
            slot > 0,
            "EntryStoreWriter::calculate_attr_zone_base | slot {} out of bounds",
            slot
        );
        mem_attrs_start_offset + ((slot - 1) * ATTR_STRIDE)
    }

    pub fn to_reader(&self) -> EntryStoreReader<CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
        EntryStoreReader::<CORE_STRIDE, META_STRIDE, ATTR_STRIDE>::bind(
            Arc::clone(&self.mem),
            self.tb.to_reader(),
            self.allocator.to_staging_buffer_reader(),
            self.mem_start_offset,
            self.mem_attrs_start_offset,
            self.mem_end_offset,
            self.tb_start_offset,
            self.tb_end_offset,
            self.capacity,
        )
    }

    pub fn len(&self) -> usize {
        self.allocator.alloc_count()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn mem_staging_buffer_start_offset(&self) -> usize {
        self.allocator.mem_staging_buffer_start_offset()
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn utilization(&self) -> f32 {
        self.allocator.utilization()
    }

    pub fn is_active_slot(&self, slot: usize) -> bool {
        self.allocator.is_active(slot)
    }

    #[inline]
    pub fn get(&'_ self, slot: usize) -> EntryWriter<'_, CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "EntryStoreWriter.get | attempted to read inactive slot {}",
            slot
        );

        let tb_start_offset = self.get_entry_tb_base(slot);
        let mem_start_offset = self.get_entry_mem_base(slot);

        EntryWriter::new(
            TbZoneWriter::new(&self.tb, tb_start_offset),
            TbZoneWriter::new(&self.tb, tb_start_offset + CORE_STRIDE),
            MemZoneWriter::new(&self.mem, mem_start_offset),
        )
    }

    #[inline]
    pub fn get_handle(
        &'_ self,
        slot: usize,
    ) -> EntryHandle<'_, CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "EntryStoreWriter.get | attempted to read inactive slot {}",
            slot
        );

        let tb_start_offset = self.get_entry_tb_base(slot);
        let mem_start_offset = self.get_entry_mem_base(slot);

        EntryHandle::new(
            TbZoneView::new(&self.tb, tb_start_offset),
            TbZoneWriter::new(&self.tb, tb_start_offset + CORE_STRIDE),
            MemZoneWriter::new(&self.mem, mem_start_offset),
        )
    }

    pub fn insert(&self) -> Option<usize> {
        let result = self.allocator.alloc();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let tb_start_offset = Self::calculate_struct_zone_base(self.tb_start_offset, new_slot);

        for i in 0..(CORE_STRIDE + META_STRIDE) {
            self.tb.write(tb_start_offset + i, 0)
        }

        self.get(new_slot).attr_clear_all();

        Some(new_slot)
    }

    pub fn remove(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.allocator.defer_free(slot)
    }

    pub fn publish(&self) {
        self.allocator.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "EntryStoreWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.allocator.copy_from(&source.allocator);
        self.tb.copy_region_from(
            &source.tb,
            source.tb_start_offset,
            self.tb_start_offset,
            Self::calculate_size_on_tb(source.capacity),
        );

        for i in 0..source.capacity * ATTR_STRIDE {
            self.mem[self.mem_attrs_start_offset + i].store(
                source.mem[source.mem_attrs_start_offset + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }

    fn get_entry_tb_base(&self, slot: usize) -> usize {
        let tb_start_offset = Self::calculate_struct_zone_base(self.tb_start_offset, slot);
        let tb_end_offset = tb_start_offset + CORE_STRIDE + META_STRIDE;

        debug_assert!(
            tb_end_offset <= self.tb.buffer_capacity(),
            "EntryStoreWriter.get | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            CORE_STRIDE + META_STRIDE,
            self.tb.buffer_capacity(),
        );

        tb_start_offset
    }

    fn get_entry_mem_base(&self, slot: usize) -> usize {
        let mem_start_offset = Self::calculate_attr_zone_base(self.mem_attrs_start_offset, slot);

        debug_assert!(
            mem_start_offset + ATTR_STRIDE <= self.mem_end_offset,
            "EntryStoreWriter.get | slot {} out of bounds",
            slot,
        );

        mem_start_offset
    }
}
