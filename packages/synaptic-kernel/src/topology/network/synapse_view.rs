use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::entry_view::EntryView;

/// Producer-side read-only structural facade for a graph synapse on the triple buffer.
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
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
pub struct SynapseView<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    entry_view: EntryView<'a, SYNAPSE_STRIDE, META_STRIDE, ATTR_STRIDE>,
}

impl<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    SynapseView<'a, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(entry_view: EntryView<'a, SYNAPSE_STRIDE, META_STRIDE, ATTR_STRIDE>) -> Self {
        SynapseView { entry_view }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.entry_view.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_source_ptr(&self) -> usize {
        self.entry_view.core_read(1) as usize
    }

    #[inline]
    pub fn get_target_ptr(&self) -> usize {
        self.entry_view.core_read(2) as usize
    }

    #[inline]
    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.entry_view.core_read(3) as usize
    }

    #[inline]
    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.entry_view.core_read(4) as usize
    }

    #[inline]
    pub fn get_incoming_next_ptr(&self) -> usize {
        self.entry_view.core_read(5) as usize
    }

    #[inline]
    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.entry_view.core_read(6) as usize
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.entry_view.meta_read(offset)
    }

    #[inline]
    pub fn get_meta_all(&self) -> [i32; META_STRIDE] {
        self.entry_view.meta_read_all()
    }
}
