use crate::primitives::tb_zone_writer::TbZoneWriter;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;

/// Producer-side structural facade for a dual-zone structural block on the triple buffer.
///
/// Wraps two `TbZoneWriter`s (core and metadata)
/// to provide a strict interface over the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TbZoneWriter`s.
pub struct StructWriter<'a, const CORE_STRIDE: usize, const META_STRIDE: usize> {
    core: TbZoneWriter<'a, CORE_STRIDE>,
    meta: TbZoneWriter<'a, META_STRIDE>,
}

impl<'a, const CORE_STRIDE: usize, const META_STRIDE: usize>
    StructWriter<'a, CORE_STRIDE, META_STRIDE>
{
    pub fn new(tb: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + CORE_STRIDE + META_STRIDE;

        debug_assert!(
            tb_end_offset <= tb.buffer_capacity(),
            "StructWriter::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            CORE_STRIDE + META_STRIDE,
            tb.buffer_capacity(),
        );

        StructWriter {
            core: TbZoneWriter::new(&tb, tb_start_offset),
            meta: TbZoneWriter::new(&tb, tb_start_offset + CORE_STRIDE),
        }
    }

    #[inline]
    pub fn core_read(&self, offset: usize) -> i32 {
        self.core.read(offset)
    }

    #[inline]
    pub fn core_write(&self, offset: usize, value: i32) {
        self.core.write(offset, value)
    }

    #[inline]
    pub fn core_read_all(&self) -> [i32; CORE_STRIDE] {
        self.core.read_all()
    }

    #[inline]
    pub fn core_write_all(&self, data: [i32; CORE_STRIDE]) {
        self.core.write_all(data)
    }

    #[inline]
    pub fn meta_read(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }

    #[inline]
    pub fn meta_write(&self, offset: usize, value: i32) {
        self.meta.write(offset, value)
    }

    #[inline]
    pub fn meta_read_all(&self) -> [i32; META_STRIDE] {
        self.meta.read_all()
    }

    #[inline]
    pub fn meta_write_all(&self, data: [i32; META_STRIDE]) {
        self.meta.write_all(data)
    }
}
