use crate::primitives::mem_zone_reader::MemZoneReader;
use crate::primitives::tb_zone_reader::TbZoneReader;

/// Consumer-side structural facade for an entry spanning three zones: `core` and `meta`
/// on the triple-buffer plane, `attr` on the mem plane.
///
/// Wraps two `TbZoneReader`s (core and metadata) and a `MemZoneReader` (attributes)
/// to provide a strict read-only interface over the raw atomic memory block.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `TbZoneReader`s and `MemZoneReader`.
///
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
pub struct EntryReader<'a> {
    core: TbZoneReader<'a>,
    meta: TbZoneReader<'a>,
    attr: MemZoneReader<'a>,
}

impl<'a> EntryReader<'a> {
    pub fn new(
        core: TbZoneReader<'a>,
        meta: TbZoneReader<'a>,
        attributes: MemZoneReader<'a>,
    ) -> Self {
        EntryReader {
            core,
            meta,
            attr: attributes,
        }
    }

    #[inline]
    pub fn core_read(&self, offset: usize) -> i32 {
        self.core.read(offset)
    }

    #[inline]
    pub fn core_read_all<const CORE_STRIDE: usize>(&self) -> [i32; CORE_STRIDE] {
        debug_assert_eq!(
            CORE_STRIDE, self.core.stride,
            "EntryReader::core_read_all | CORE_STRIDE {} must be equal to pre-configured stride {}",
            CORE_STRIDE, self.core.stride
        );

        self.core.read_all()
    }

    #[inline]
    pub fn meta_read(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }

    #[inline]
    pub fn meta_read_all<const META_STRIDE: usize>(&self) -> [i32; META_STRIDE] {
        debug_assert_eq!(
            META_STRIDE, self.meta.stride,
            "EntryReader::meta_read_all | META_STRIDE {} must be equal to pre-configured stride {}",
            META_STRIDE, self.meta.stride
        );

        self.meta.read_all()
    }

    #[inline]
    pub fn attr_read(&self, offset: usize) -> i32 {
        self.attr.read(offset)
    }

    #[inline]
    pub fn attr_read_all<const ATTR_STRIDE: usize>(&self) -> [i32; ATTR_STRIDE] {
        debug_assert_eq!(
            ATTR_STRIDE, self.attr.stride,
            "EntryReader::attr_read_all | ATTR_STRIDE {} must be equal to pre-configured stride {}",
            ATTR_STRIDE, self.attr.stride
        );

        self.attr.read_all()
    }
}
