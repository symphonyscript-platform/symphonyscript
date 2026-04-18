use crate::constants::NODE_SIZE;
use crate::primitives::struct_reader::StructReader;

/// Consumer-side structural facade for a graph node on the triple buffer.
///
/// Wraps two `SlotReader`s (core structural pointers and custom metadata)
/// to provide a strict read-only interface over the raw atomic memory block.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `SlotReader`s.
///
/// # Core Layout (8x i32)
/// Shares backing region with `NodeWriter`. See its layout.
///
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
pub struct NodeReader<'a, const META_SIZE: usize> {
    struct_reader: StructReader<'a, NODE_SIZE, META_SIZE>,
}

impl<'a, const META_SIZE: usize> NodeReader<'a, META_SIZE> {
    pub fn new(struct_reader: StructReader<'a, NODE_SIZE, META_SIZE>) -> Self {
        NodeReader { struct_reader }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.struct_reader.read_core(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_next_ptr(&self) -> usize {
        self.struct_reader.read_core(1) as usize
    }

    #[inline]
    pub fn get_prev_ptr(&self) -> usize {
        self.struct_reader.read_core(2) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.struct_reader.read_core(3) as usize
    }

    #[inline]
    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.struct_reader.read_core(4) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_head(&self) -> usize {
        self.struct_reader.read_core(5) as usize
    }

    #[inline]
    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.struct_reader.read_core(6) as usize
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.struct_reader.read_meta(offset)
    }
}
