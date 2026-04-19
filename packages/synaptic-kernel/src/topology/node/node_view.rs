use crate::constants::NODE_STRIDE;
use crate::primitives::entry_view::EntryView;

/// Producer-side read-only structural facade for a graph node on the triple buffer.
///
/// Wraps a `EntryWriter` to provide a strict read-only interface over
/// the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `EntryView`.
///
/// # Core Layout (8x i32)
/// Shares backing region with `NodeWriter`. See its layout.
pub struct NodeView<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    entry_view: EntryView<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
}

impl<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    NodeView<'a, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(entry_view: EntryView<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>) -> Self {
        NodeView { entry_view }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.entry_view.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_next_ptr(&self) -> usize {
        self.entry_view.core_read(1) as usize
    }

    #[inline]
    pub fn get_prev_ptr(&self) -> usize {
        self.entry_view.core_read(2) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.entry_view.core_read(3) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.entry_view.core_read(4) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_head(&self) -> usize {
        self.entry_view.core_read(5) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_tail(&self) -> usize {
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
