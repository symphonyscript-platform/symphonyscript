use crate::constants::SYNAPSE_STRIDE;
use crate::primitives::struct_reader::StructReader;

/// Consumer-side structural facade for a graph synapse on the triple buffer.
///
/// Wraps a `StructReader` (core structural pointers and custom metadata)
/// to provide a strict read-only interface over the raw atomic memory block.
///
/// # Threading
/// Consumer thread only. Delegates back to the underlying `StructReader`s.
///
/// # Core Layout (8x i32)
/// Shares backing region with `SynapseWriter`. See its layout.
///
/// # Encapsulation
/// - Read-only: structural mutation is strictly prohibited on the reading plane.
pub struct SynapseReader<'a, const META_STRIDE: usize> {
    struct_reader: StructReader<'a, SYNAPSE_STRIDE, META_STRIDE>,
}

impl<'a, const META_STRIDE: usize> SynapseReader<'a, META_STRIDE> {
    pub fn new(struct_reader: StructReader<'a, SYNAPSE_STRIDE, META_STRIDE>) -> Self {
        SynapseReader { struct_reader }
    }

    #[inline]
    pub fn get_kind(&self) -> i32 {
        (self.struct_reader.core_read(0) as u32 >> 24) as i32
    }

    #[inline]
    pub fn get_source_ptr(&self) -> usize {
        self.struct_reader.core_read(1) as usize
    }

    #[inline]
    pub fn get_target_ptr(&self) -> usize {
        self.struct_reader.core_read(2) as usize
    }

    #[inline]
    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.struct_reader.core_read(3) as usize
    }

    #[inline]
    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.struct_reader.core_read(4) as usize
    }

    #[inline]
    pub fn get_incoming_next_ptr(&self) -> usize {
        self.struct_reader.core_read(5) as usize
    }

    #[inline]
    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.struct_reader.core_read(6) as usize
    }

    #[inline]
    pub fn get_meta(&self, offset: usize) -> i32 {
        self.struct_reader.meta_read(offset)
    }

    #[inline]
    pub fn get_meta_all(&self) -> [i32; META_STRIDE] {
        self.struct_reader.meta_read_all()
    }
}
