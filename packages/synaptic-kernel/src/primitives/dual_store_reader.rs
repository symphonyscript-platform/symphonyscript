use crate::attributes::attribute_plane_reader::AttributePlaneReader;
use crate::attributes::attribute_plane_writer::AttributePlaneWriter;
use crate::primitives::dual_store_writer::DualStoreWriter;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::struct_reader::StructReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;

#[derive(Clone)]
pub struct DualStoreReader<
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    tb: TripleBufferReader,
    attributes: AttributePlaneReader<ATTR_STRIDE>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}
impl<const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    DualStoreReader<CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn bind(
        tb: TripleBufferReader,
        attributes: AttributePlaneReader<ATTR_STRIDE>,
        mem_start_offset: usize,
        mem_end_offset: usize,
        tb_start_offset: usize,
        tb_end_offset: usize,
        capacity: usize,
    ) -> Self {
        DualStoreReader {
            tb,
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
    pub fn core_read(&self, slot: usize, offset: usize) -> i32 {
        self.get_struct(slot).core_read(offset)
    }

    #[inline]
    pub fn core_read_all(&self, slot: usize) -> [i32; CORE_STRIDE] {
        self.get_struct(slot).core_read_all()
    }

    #[inline]
    pub fn meta_read(&self, slot: usize, offset: usize) -> i32 {
        self.get_struct(slot).meta_read(offset)
    }

    #[inline]
    pub fn meta_read_all(&self, slot: usize) -> [i32; META_STRIDE] {
        self.get_struct(slot).meta_read_all()
    }

    #[inline]
    pub fn attr_read(&self, slot: usize, offset: usize) -> i32 {
        self.attributes.read(slot, offset)
    }

    #[inline]
    pub fn attr_read_all(&self, slot: usize) -> [i32; ATTR_STRIDE] {
        self.attributes.read_all(slot)
    }

    #[inline]
    pub fn get_struct(&'_ self, slot: usize) -> StructReader<'_, CORE_STRIDE, META_STRIDE> {
        let start_offset =
            DualStoreWriter::<CORE_STRIDE, META_STRIDE, ATTR_STRIDE>::calculate_struct_start_offset(
                self.tb_start_offset,
                slot,
            );
        StructReader::new(&self.tb, start_offset)
    }
}
