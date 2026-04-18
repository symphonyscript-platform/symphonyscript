use crate::primitives::tb_zone_reader::TbZoneReader;
use crate::primitives::triple_buffer_reader::TripleBufferReader;

/// Consumer-side structural facade for a dual-zone structural block on the triple buffer.
///
/// Wraps two `TbZoneReader`s (core and metadata)
/// to provide a strict read-only interface over the raw atomic memory block.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `TbZoneReader`s.
///
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
pub struct StructReader<'a, const CORE_STRIDE: usize, const META_STRIDE: usize> {
    core: TbZoneReader<'a, CORE_STRIDE>,
    meta: TbZoneReader<'a, META_STRIDE>,
}

impl<'a, const CORE_STRIDE: usize, const META_STRIDE: usize>
    StructReader<'a, CORE_STRIDE, META_STRIDE>
{
    pub fn new(triple_buffer: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + CORE_STRIDE + META_STRIDE;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "StructReader::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            CORE_STRIDE + META_STRIDE,
            triple_buffer.buffer_capacity(),
        );

        StructReader {
            core: TbZoneReader::new(&triple_buffer, tb_start_offset),
            meta: TbZoneReader::new(&triple_buffer, tb_start_offset + CORE_STRIDE),
        }
    }

    #[inline]
    pub fn core_read(&self, offset: usize) -> i32 {
        self.core.read(offset)
    }

    #[inline]
    pub fn core_read_all(&self) -> [i32; CORE_STRIDE] {
        self.core.read_all()
    }

    #[inline]
    pub fn meta_read(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }

    #[inline]
    pub fn meta_read_all(&self) -> [i32; META_STRIDE] {
        self.meta.read_all()
    }
}
