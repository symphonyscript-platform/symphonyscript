use crate::constants::NODE_SIZE;
use crate::primitives::struct_writer::StructWriter;

/// Producer-side structural facade for a graph node on the triple buffer.
///
/// Wraps two `SlotWriter`s (core structural pointers and custom metadata)
/// to provide a strict interface over the raw atomic memory block.
///
/// # Threading
/// Producer thread only. Delegates back to the underlying `SlotWriter`s.
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
/// Followed by `META_SIZE` `i32` slots for custom topology metadata.
///
/// # Encapsulation
/// - All mutation methods (`set_*`) are `pub(crate)`. Only the kernel can mutate
///   active topology, enforcing structural graph invariants.
pub struct NodeWriter<'a, const META_SIZE: usize> {
    struct_writer: StructWriter<'a, NODE_SIZE, META_SIZE>,
}

impl<'a, const META_SIZE: usize> NodeWriter<'a, META_SIZE> {
    pub fn new(struct_writer: StructWriter<'a, NODE_SIZE, META_SIZE>) -> Self {
        NodeWriter { struct_writer }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.struct_writer.read_core(0) as u32 >> 24) as i32
    }

    #[inline]
    pub(crate) fn set_kind(&self, value: i32) {
        let bitmask = self.struct_writer.read_core(0) & ((1 << 24) - 1);
        self.struct_writer.write_core(0, bitmask | value << 24)
    }

    #[inline]
    pub fn get_next_ptr(&self) -> usize {
        self.struct_writer.read_core(1) as usize
    }

    #[inline]
    pub(crate) fn set_next_ptr(&self, value: usize) {
        self.struct_writer.write_core(1, value as i32)
    }

    #[inline]
    pub fn get_prev_ptr(&self) -> usize {
        self.struct_writer.read_core(2) as usize
    }

    #[inline]
    pub(crate) fn set_prev_ptr(&self, value: usize) {
        self.struct_writer.write_core(2, value as i32)
    }

    #[inline]
    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.struct_writer.read_core(3) as usize
    }

    #[inline]
    pub(crate) fn set_outgoing_synapse_head(&self, value: usize) {
        self.struct_writer.write_core(3, value as i32)
    }

    #[inline]
    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.struct_writer.read_core(4) as usize
    }

    #[inline]
    pub(crate) fn set_outgoing_synapse_tail(&self, value: usize) {
        self.struct_writer.write_core(4, value as i32)
    }

    #[inline]
    pub fn get_incoming_synapse_head(&self) -> usize {
        self.struct_writer.read_core(5) as usize
    }

    #[inline]
    pub(crate) fn set_incoming_synapse_head(&self, value: usize) {
        self.struct_writer.write_core(5, value as i32)
    }

    #[inline]
    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.struct_writer.read_core(6) as usize
    }

    #[inline]
    pub(crate) fn set_incoming_synapse_tail(&self, value: usize) {
        self.struct_writer.write_core(6, value as i32)
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.struct_writer.read_meta(offset)
    }

    #[inline]
    pub fn set_meta(&self, offset: usize, value: i32) {
        self.struct_writer.write_meta(offset, value)
    }
}
