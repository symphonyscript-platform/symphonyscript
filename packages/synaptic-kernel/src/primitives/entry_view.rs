use crate::primitives::mem_zone_reader::MemZoneReader;
use crate::primitives::tb_zone_view::TbZoneView;

/// Producer-side read-only structural facade for an entry spanning three zones: `core` and `meta`
/// on the triple-buffer plane, `attr` on the mem plane.
///
/// Wraps two `TbZoneWriter`s (core and metadata) and a `MemZoneWriter` (attributes)
/// to provide a strict interface over the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TbZoneWriter`s and `MemZoneWriter`.
pub struct EntryView<
    'a,
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    core: TbZoneView<'a, CORE_STRIDE>,
    meta: TbZoneView<'a, META_STRIDE>,
    attributes: MemZoneReader<'a, ATTR_STRIDE>,
}

impl<'a, const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    EntryView<'a, CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(
        core: TbZoneView<'a, CORE_STRIDE>,
        meta: TbZoneView<'a, META_STRIDE>,
        attributes: MemZoneReader<'a, ATTR_STRIDE>,
    ) -> Self {
        EntryView {
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
