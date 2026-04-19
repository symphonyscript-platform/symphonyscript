use crate::constants::NODE_STRIDE;
use crate::primitives::entry_handle::EntryHandle;

/// Producer-side safe facade for a graph node on the triple buffer.
///
/// Wraps a `EntryWriter` to provide a strict read-only interface over
/// the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `EntryView`.
///
/// # Core Layout (8x i32)
/// Shares backing region with `NodeWriter`. See its layout.
///
/// # Constraints
/// - Treats core zone as readonly. meta zone stays writable as it belongs to user domain.
pub struct NodeHandle<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    entry_handle: EntryHandle<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
}

impl<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    NodeHandle<'a, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(entry_handle: EntryHandle<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>) -> Self {
        NodeHandle { entry_handle }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.entry_handle.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_next_ptr(&self) -> usize {
        self.entry_handle.core_read(1) as usize
    }

    #[inline]
    pub fn get_prev_ptr(&self) -> usize {
        self.entry_handle.core_read(2) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.entry_handle.core_read(3) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.entry_handle.core_read(4) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_head(&self) -> usize {
        self.entry_handle.core_read(5) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.entry_handle.core_read(6) as usize
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.entry_handle.meta_read(offset)
    }

    #[inline]
    pub fn get_meta_all(&self) -> [i32; META_STRIDE] {
        self.entry_handle.meta_read_all()
    }

    #[inline]
    pub fn set_meta(&self, offset: usize, value: i32) {
        self.entry_handle.meta_write(offset, value)
    }

    #[inline]
    pub fn set_meta_all(&self, data: [i32; META_STRIDE]) {
        self.entry_handle.meta_write_all(data)
    }

    #[inline]
    pub fn attr_read(&self, offset: usize) -> i32 {
        self.entry_handle.attr_read(offset)
    }

    #[inline]
    pub fn attr_write(&self, offset: usize, value: i32) {
        self.entry_handle.attr_write(offset, value)
    }

    #[inline]
    pub fn attr_and(&self, offset: usize, value: i32) -> i32 {
        self.entry_handle.attr_and(offset, value)
    }

    #[inline]
    pub fn attr_or(&self, offset: usize, value: i32) -> i32 {
        self.entry_handle.attr_or(offset, value)
    }

    #[inline]
    pub fn attr_read_all(&self) -> [i32; ATTR_STRIDE] {
        self.entry_handle.attr_read_all()
    }

    #[inline]
    pub fn attr_write_all(&self, data: [i32; ATTR_STRIDE]) {
        self.entry_handle.attr_write_all(data)
    }

    #[inline]
    pub fn attr_clear_all(&self) {
        self.entry_handle.attr_clear_all()
    }
}
