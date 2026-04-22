use crate::primitives::mem_zone_writer::MemZoneWriter;
use crate::primitives::tb_zone_view::TbZoneView;
use crate::primitives::tb_zone_writer::TbZoneWriter;

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
/// - Treats core zone as readonly. meta zone stays writable as it belongs to user domain.
pub struct EntryHandle<'a> {
    core: TbZoneView<'a>,
    meta: TbZoneWriter<'a>,
    attr: MemZoneWriter<'a>,
}

impl<'a> EntryHandle<'a> {
    pub fn new(
        core: TbZoneView<'a>,
        meta: TbZoneWriter<'a>,
        attributes: MemZoneWriter<'a>,
    ) -> Self {
        EntryHandle {
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
            "EntryHandle::core_read_all | CORE_STRIDE {} must be equal to pre-configured stride {}",
            CORE_STRIDE, self.core.stride
        );

        self.core.read_all()
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
    pub fn meta_read_all<const META_STRIDE: usize>(&self) -> [i32; META_STRIDE] {
        debug_assert_eq!(
            META_STRIDE, self.meta.stride,
            "EntryHandle::meta_read_all | META_STRIDE {} must be equal to pre-configured stride {}",
            META_STRIDE, self.meta.stride
        );

        self.meta.read_all()
    }

    #[inline]
    pub fn meta_write_all<const META_STRIDE: usize>(&self, data: [i32; META_STRIDE]) {
        debug_assert_eq!(
            META_STRIDE, self.meta.stride,
            "EntryHandle::meta_write_all | META_STRIDE {} must be equal to pre-configured stride {}",
            META_STRIDE, self.meta.stride
        );

        self.meta.write_all(data)
    }

    #[inline]
    pub fn attr_read(&self, offset: usize) -> i32 {
        self.attr.read(offset)
    }

    #[inline]
    pub fn attr_write(&self, offset: usize, value: i32) {
        self.attr.write(offset, value)
    }

    #[inline]
    pub fn attr_and(&self, offset: usize, value: i32) -> i32 {
        self.attr.and(offset, value)
    }

    #[inline]
    pub fn attr_or(&self, offset: usize, value: i32) -> i32 {
        self.attr.or(offset, value)
    }

    #[inline]
    pub fn attr_read_all<const ATTR_STRIDE: usize>(&self) -> [i32; ATTR_STRIDE] {
        debug_assert_eq!(
            ATTR_STRIDE, self.attr.stride,
            "EntryHandle::attr_read_all | ATTR_STRIDE {} must be equal to pre-configured stride {}",
            ATTR_STRIDE, self.attr.stride
        );

        self.attr.read_all()
    }

    #[inline]
    pub fn attr_write_all<const ATTR_STRIDE: usize>(&self, data: [i32; ATTR_STRIDE]) {
        debug_assert_eq!(
            ATTR_STRIDE, self.attr.stride,
            "EntryHandle::attr_write_all | ATTR_STRIDE {} must be equal to pre-configured stride {}",
            ATTR_STRIDE, self.attr.stride
        );

        self.attr.write_all(data)
    }

    #[inline]
    pub fn attr_clear_all<const ATTR_STRIDE: usize>(&self) {
        debug_assert_eq!(
            ATTR_STRIDE, self.attr.stride,
            "EntryHandle::attr_clear_all | ATTR_STRIDE {} must be equal to pre-configured stride {}",
            ATTR_STRIDE, self.attr.stride
        );

        self.attr.write_all([0; ATTR_STRIDE])
    }
}
