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
pub struct EntryReader<
    'a,
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    core: TbZoneReader<'a, CORE_STRIDE>,
    meta: TbZoneReader<'a, META_STRIDE>,
    attributes: MemZoneReader<'a, ATTR_STRIDE>,
}

impl<'a, const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    EntryReader<'a, CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(
        core: TbZoneReader<'a, CORE_STRIDE>,
        meta: TbZoneReader<'a, META_STRIDE>,
        attributes: MemZoneReader<'a, ATTR_STRIDE>,
    ) -> Self {
        EntryReader {
            core,
            meta,
            attributes,
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

    #[inline]
    pub fn attr_read(&self, offset: usize) -> i32 {
        self.attributes.read(offset)
    }

    #[inline]
    pub fn attr_read_all(&self) -> [i32; ATTR_STRIDE] {
        self.attributes.read_all()
    }
}
