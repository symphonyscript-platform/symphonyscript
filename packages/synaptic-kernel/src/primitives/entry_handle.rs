use crate::primitives::mem_zone_writer::MemZoneWriter;
use crate::primitives::tb_zone_view::TbZoneView;

/// Producer-side safe facade for an entry spanning three zones: `core` and `meta`
/// on the triple-buffer plane, `attr` on the mem plane.
///
/// Wraps two `TbZoneWriter`s (core and metadata) and a `MemZoneWriter` (attributes)
/// to provide a strict interface over the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `TbZoneWriter`s and `MemZoneWriter`.
///
/// # Constraints
/// - Treats all structural data is readonly, including meta.
pub struct EntryHandle<
    'a,
    const CORE_STRIDE: usize,
    const META_STRIDE: usize,
    const ATTR_STRIDE: usize,
> {
    core: TbZoneView<'a, CORE_STRIDE>,
    meta: TbZoneView<'a, META_STRIDE>,
    attributes: MemZoneWriter<'a, ATTR_STRIDE>,
}

impl<'a, const CORE_STRIDE: usize, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    EntryHandle<'a, CORE_STRIDE, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(
        core: TbZoneView<'a, CORE_STRIDE>,
        meta: TbZoneView<'a, META_STRIDE>,
        attributes: MemZoneWriter<'a, ATTR_STRIDE>,
    ) -> Self {
        EntryHandle {
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
    pub fn attr_write(&self, offset: usize, value: i32) {
        self.attributes.write(offset, value)
    }

    #[inline]
    pub fn attr_and(&self, offset: usize, value: i32) -> i32 {
        self.attributes.and(offset, value)
    }

    #[inline]
    pub fn attr_or(&self, offset: usize, value: i32) -> i32 {
        self.attributes.or(offset, value)
    }

    #[inline]
    pub fn attr_read_all(&self) -> [i32; ATTR_STRIDE] {
        self.attributes.read_all()
    }

    #[inline]
    pub fn attr_write_all(&self, data: [i32; ATTR_STRIDE]) {
        self.attributes.write_all(data)
    }

    #[inline]
    pub fn attr_clear_all(&self) {
        self.attributes.write_all([0; ATTR_STRIDE])
    }
}
