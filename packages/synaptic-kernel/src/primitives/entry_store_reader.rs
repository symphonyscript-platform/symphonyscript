use crate::primitives::entry_reader::EntryReader;
use crate::primitives::entry_handle::EntryHandle;
use crate::primitives::mem_zone_reader::MemZoneReader;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::staging_buffer_reader::StagingBufferReader;
use crate::primitives::tb_zone_reader::TbZoneReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::primitives::types::AtomicBuffer;

#[derive(Clone)]
pub struct EntryStoreReader<
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    mem: AtomicBuffer,
    tb: TripleBufferReader,
    staging_buffer_reader: StagingBufferReader,
    mem_start_offset: usize,
    mem_attrs_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}
impl<const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    EntryStoreReader<CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn bind(
        mem: AtomicBuffer,
        tb: TripleBufferReader,
        staging_buffer_reader: StagingBufferReader,
        mem_start_offset: usize,
        mem_attrs_start_offset: usize,
        mem_end_offset: usize,
        tb_start_offset: usize,
        tb_end_offset: usize,
        capacity: usize,
    ) -> Self {
        EntryStoreReader {
            mem,
            tb,
            staging_buffer_reader,
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

    #[inline]
    pub(crate) fn calculate_struct_zone_base(tb_start_offset: usize, slot: usize) -> usize {
        debug_assert!(
            slot > 0,
            "EntryStoreReader::calculate_struct_zone_base | slot {} out of bounds",
            slot
        );
        tb_start_offset + (slot - 1) * (CORE_STRIDE + META_STRIDE)
    }

    #[inline]
    pub(crate) fn calculate_attr_zone_base(mem_attrs_start_offset: usize, slot: usize) -> usize {
        debug_assert!(
            slot > 0,
            "EntryStoreReader::calculate_attr_zone_base | slot {} out of bounds",
            slot
        );
        mem_attrs_start_offset + ((slot - 1) * ATTR_STRIDE)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity * (CORE_STRIDE + META_STRIDE)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
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

    #[inline]
    pub fn get(&'_ self, slot: usize) -> EntryReader<'_, CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
        let tb_start_offset = self.get_entry_tb_base(slot);
        let mem_start_offset = self.get_entry_mem_base(slot);

        EntryReader::new(
            TbZoneReader::new(&self.tb, tb_start_offset),
            TbZoneReader::new(&self.tb, tb_start_offset + CORE_STRIDE),
            MemZoneReader::new(&self.mem, mem_start_offset),
        )
    }

    pub fn ack_generation(&self) {
        self.staging_buffer_reader.ack()
    }

    fn get_entry_tb_base(&self, slot: usize) -> usize {
        let tb_start_offset = Self::calculate_struct_zone_base(self.tb_start_offset, slot);
        let tb_end_offset = tb_start_offset + CORE_STRIDE + META_STRIDE;

        debug_assert!(
            tb_end_offset <= self.tb.buffer_capacity(),
            "EntryStoreReader.get | range [{}..{}] exceeds buffer capacity {}",
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
            "EntryStoreReader.get | slot {} out of bounds",
            slot,
        );

        mem_start_offset
    }
}
