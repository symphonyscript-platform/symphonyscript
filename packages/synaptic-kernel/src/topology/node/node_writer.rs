use crate::constants::NODE_STRIDE;
use crate::primitives::entry_writer::EntryWriter;

/// Producer-side structural facade for a graph node on the triple buffer.
///
/// Wraps a `EntryWriter` to provide a strict interface over
/// the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `EntryWriter`.
///
/// # Core Layout (8x i32)
/// - `0`: `kind` (shifted by 24 bits) combined with potential future internal flags (lower 24 bits).
/// - `1`: `next_ptr`
/// - `2`: `prev_ptr`
/// - `3`: `outgoing_synapse_head`
/// - `4`: `outgoing_synapse_tail`
/// - `5`: `incoming_synapse_head`
/// - `6`: `incoming_synapse_tail`
/// - `7`: (Reserved for future use)
///
/// Followed by `META_STRIDE` `i32` slots for custom topology metadata.
///
/// # Encapsulation
/// - All mutation methods (`set_*`) are `pub` except meta setters.
///   Only the kernel can mutate active topology, enforcing structural graph invariants.
pub struct NodeWriter<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize> {
    entry_writer: EntryWriter<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>,
}

impl<'a, const META_STRIDE: usize, const ATTR_STRIDE: usize>
    NodeWriter<'a, META_STRIDE, ATTR_STRIDE>
{
    pub fn new(entry_writer: EntryWriter<'a, NODE_STRIDE, META_STRIDE, ATTR_STRIDE>) -> Self {
        NodeWriter { entry_writer }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.entry_writer.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn set_kind(&self, value: i32) {
        debug_assert!(
            value >= 0 && value < 256,
            "NodeWriter.set_kind | kind {} out of bounds [0, 256)",
            value
        );
        let bitmask = self.entry_writer.core_read(0) & ((1 << 24) - 1);
        self.entry_writer.core_write(0, bitmask | value << 24)
    }

    #[inline]
    pub fn get_next_ptr(&self) -> usize {
        self.entry_writer.core_read(1) as usize
    }

    #[inline]
    pub fn set_next_ptr(&self, value: usize) {
        self.entry_writer.core_write(1, value as i32)
    }

    #[inline]
    pub fn get_prev_ptr(&self) -> usize {
        self.entry_writer.core_read(2) as usize
    }

    #[inline]
    pub fn set_prev_ptr(&self, value: usize) {
        self.entry_writer.core_write(2, value as i32)
    }

    #[inline]
    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.entry_writer.core_read(3) as usize
    }

    #[inline]
    pub fn set_outgoing_synapse_head(&self, value: usize) {
        self.entry_writer.core_write(3, value as i32)
    }

    #[inline]
    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.entry_writer.core_read(4) as usize
    }

    #[inline]
    pub fn set_outgoing_synapse_tail(&self, value: usize) {
        self.entry_writer.core_write(4, value as i32)
    }

    #[inline]
    pub fn get_incoming_synapse_head(&self) -> usize {
        self.entry_writer.core_read(5) as usize
    }

    #[inline]
    pub fn set_incoming_synapse_head(&self, value: usize) {
        self.entry_writer.core_write(5, value as i32)
    }

    #[inline]
    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.entry_writer.core_read(6) as usize
    }

    #[inline]
    pub fn set_incoming_synapse_tail(&self, value: usize) {
        self.entry_writer.core_write(6, value as i32)
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.entry_writer.meta_read(offset)
    }

    #[inline]
    pub fn get_meta_all(&self) -> [i32; META_STRIDE] {
        self.entry_writer.meta_read_all()
    }

    #[inline]
    pub fn set_meta(&self, offset: usize, value: i32) {
        self.entry_writer.meta_write(offset, value)
    }

    #[inline]
    pub fn set_meta_all(&self, data: [i32; META_STRIDE]) {
        self.entry_writer.meta_write_all(data)
    }
}
