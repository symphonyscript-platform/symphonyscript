use crate::attributes::attribute_plane_reader::AttributePlaneReader;
use crate::attributes::attribute_plane_writer::AttributePlaneWriter;
use crate::errors::slot_allocator_error::SlotAllocatorError;
use crate::primitives::dual_store_reader::DualStoreReader;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::staging_buffer_reader::StagingBufferReader;
use crate::primitives::struct_writer::StructWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

pub struct DualStoreWriter<const STRUCT_STRIDE: usize, const ATTR_STRIDE: usize> {
    mem: AtomicBuffer,
    tb: TripleBufferWriter,
    allocator: SlotAllocator,
    attributes: AttributePlaneWriter<ATTR_STRIDE>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}
impl<const STRUCT_STRIDE: usize, const ATTR_STRIDE: usize>
    DualStoreWriter<STRUCT_STRIDE, ATTR_STRIDE>
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
        let allocator = SlotAllocator::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let attributes = AttributePlaneWriter::<ATTR_STRIDE>::create(
            Arc::clone(&mem),
            allocator.mem_end_offset(),
            capacity,
            bind,
        );
        let mem_end_offset = attributes.mem_end_offset();
        let tb_end_offset = tb_start_offset + Self::calculate_size_on_tb(capacity);

        DualStoreWriter {
            mem,
            tb,
            allocator,
            attributes,
            mem_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        SlotAllocator::calculate_size_on_mem(capacity)
            + AttributePlaneWriter::<ATTR_STRIDE>::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity * STRUCT_STRIDE
    }

    pub(crate) fn calculate_struct_start_offset(tb_start_offset: usize, slot: usize) -> usize {
        tb_start_offset + (slot - 1) * STRUCT_STRIDE
    }

    pub fn to_reader(&self) -> DualStoreReader<STRUCT_STRIDE, ATTR_STRIDE> {
        DualStoreReader::<STRUCT_STRIDE, ATTR_STRIDE>::bind(
            self.tb.to_reader(),
            AttributePlaneReader::bind(
                Arc::clone(&self.mem),
                self.attributes.mem_start_offset(),
                self.capacity,
            ),
            self.mem_start_offset,
            self.mem_end_offset,
            self.tb_start_offset,
            self.tb_end_offset,
            self.capacity,
        )
    }

    pub fn to_staging_buffer_reader(&self) -> StagingBufferReader {
        self.allocator.to_staging_buffer_reader()
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

    pub fn struct_read(&self, slot: usize, offset: usize) -> i32 {
        self.get_struct(slot).read(offset)
    }

    pub fn struct_write(&self, slot: usize, offset: usize, value: i32) {
        self.get_struct(slot).write(offset, value)
    }

    pub fn struct_read_all(&self, slot: usize) -> [i32; STRUCT_STRIDE] {
        self.get_struct(slot).read_all()
    }

    pub fn struct_write_all(&self, slot: usize, data: [i32; STRUCT_STRIDE]) {
        self.get_struct(slot).write_all(data)
    }

    pub fn attr_read(&self, slot: usize, offset: usize) -> i32 {
        self.attributes.read(slot, offset)
    }

    pub fn attr_write(&self, slot: usize, offset: usize, value: i32) {
        self.attributes.write(slot, offset, value)
    }

    pub fn attr_and(&self, slot: usize, offset: usize, value: i32) -> i32 {
        self.attributes.and(slot, offset, value)
    }

    pub fn attr_or(&self, slot: usize, offset: usize, value: i32) -> i32 {
        self.attributes.or(slot, offset, value)
    }

    pub fn attr_read_all(&self, slot: usize) -> [i32; ATTR_STRIDE] {
        self.attributes.read_all(slot)
    }

    pub fn attr_write_all(&self, slot: usize, data: [i32; ATTR_STRIDE]) {
        self.attributes.write_all(slot, data)
    }

    pub fn get_struct(&'_ self, slot: usize) -> StructWriter<'_, STRUCT_STRIDE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "DualStore.get_struct | attempted to read inactive slot {}",
            slot
        );
        let start_offset = Self::calculate_struct_start_offset(self.tb_start_offset, slot);
        StructWriter::new(&self.tb, start_offset)
    }

    pub fn insert_struct(&self) -> Option<usize> {
        let result = self.allocator.alloc();

        if result.is_none() {
            return None;
        }

        let new_slot = result.unwrap();
        let start_offset = Self::calculate_struct_start_offset(self.tb_start_offset, new_slot);

        for i in 0..STRUCT_STRIDE {
            self.tb.write(start_offset + i, 0)
        }

        self.attributes.clear(new_slot);

        Some(new_slot)
    }

    pub fn remove_struct(&self, slot: usize) -> Result<(), SlotAllocatorError> {
        self.allocator.defer_free(slot)
    }

    pub fn publish(&self) {
        self.allocator.publish()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "DualStore.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.allocator.copy_from(&source.allocator);
        self.attributes.copy_from(&source.attributes);
        self.tb.copy_region_from(
            &source.tb,
            source.tb_start_offset,
            self.tb_start_offset,
            Self::calculate_size_on_tb(source.capacity),
        );
    }
}
