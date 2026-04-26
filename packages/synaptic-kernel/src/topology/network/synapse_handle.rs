use crate::primitives::entry_handle::EntryHandle;

/// Producer-side safe facade for a graph synapse on the triple buffer.
///
/// Wraps a `EntryReader` to provide a strict read-only interface over
/// the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `EntryView`.
///
/// # Core Layout (8x i32)
/// Shares backing region with `SynapseWriter`. See its layout.
///
/// # Constraints
/// - Treats core zone as readonly. meta zone stays writable as it belongs to user domain.
pub struct SynapseView<'a> {
    entry: EntryHandle<'a>,
}

impl<'a> SynapseView<'a> {
    pub fn new(entry_handle: EntryHandle<'a>) -> Self {
        SynapseView {
            entry: entry_handle,
        }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.entry.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_source_ptr(&self) -> usize {
        self.entry.core_read(1) as usize
    }

    #[inline]
    pub fn get_target_ptr(&self) -> usize {
        self.entry.core_read(2) as usize
    }

    #[inline]
    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.entry.core_read(3) as usize
    }

    #[inline]
    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.entry.core_read(4) as usize
    }

    #[inline]
    pub fn get_incoming_next_ptr(&self) -> usize {
        self.entry.core_read(5) as usize
    }

    #[inline]
    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.entry.core_read(6) as usize
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.entry.meta_read(offset)
    }

    #[inline]
    pub fn get_meta_all(&self, out: &mut [i32]) {
        self.entry.meta_read_all(out)
    }

    #[inline]
    pub fn set_meta(&self, offset: usize, value: i32) {
        self.entry.meta_write(offset, value)
    }

    #[inline]
    pub fn set_meta_all(&self, data: &[i32]) {
        self.entry.meta_write_all(data)
    }

    #[inline]
    pub fn attr_read(&self, offset: usize) -> i32 {
        self.entry.attr_read(offset)
    }

    #[inline]
    pub fn attr_write(&self, offset: usize, value: i32) {
        self.entry.attr_write(offset, value)
    }

    #[inline]
    pub fn attr_and(&self, offset: usize, value: i32) -> i32 {
        self.entry.attr_and(offset, value)
    }

    #[inline]
    pub fn attr_or(&self, offset: usize, value: i32) -> i32 {
        self.entry.attr_or(offset, value)
    }

    #[inline]
    pub fn attr_read_all(&self, out: &mut [i32]) {
        self.entry.attr_read_all(out)
    }

    #[inline]
    pub fn attr_write_all(&self, data: &[i32]) {
        self.entry.attr_write_all(data)
    }

    #[inline]
    pub fn attr_clear_all(&self) {
        self.entry.attr_clear_all()
    }
}
