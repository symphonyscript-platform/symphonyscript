use crate::constants::NODE_SIZE;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::topology::slot_reader::SlotReader;

/// Reader side structural facade for a graph node on the triple buffer.
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
    core: SlotReader<'a, NODE_SIZE>,
    meta: SlotReader<'a, META_SIZE>,
}

impl<'a, const META_SIZE: usize> NodeReader<'a, META_SIZE> {
    pub fn new(triple_buffer: &'a TripleBufferReader, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + NODE_SIZE + META_SIZE;

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "NodeReader::new | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            NODE_SIZE + META_SIZE,
            triple_buffer.buffer_capacity(),
        );

        NodeReader {
            core: SlotReader::new(&triple_buffer, tb_start_offset),
            meta: SlotReader::new(&triple_buffer, tb_start_offset + NODE_SIZE),
        }
    }

    pub fn get_kind(&self) -> i32 {
        (self.core.read(0) as u32 >> 24) as i32
    }

    pub fn get_next_ptr(&self) -> usize {
        self.core.read(1) as usize
    }

    pub fn get_prev_ptr(&self) -> usize {
        self.core.read(2) as usize
    }

    pub fn get_outgoing_synapse_head(&self) -> usize {
        self.core.read(3) as usize
    }

    pub fn get_outgoing_synapse_tail(&self) -> usize {
        self.core.read(4) as usize
    }

    pub fn get_incoming_synapse_head(&self) -> usize {
        self.core.read(5) as usize
    }

    pub fn get_incoming_synapse_tail(&self) -> usize {
        self.core.read(6) as usize
    }

    pub fn get_meta(&self, offset: usize) -> i32 {
        self.meta.read(offset)
    }
}
