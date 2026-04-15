use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Consumer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read-only access to `SLOT__SIZE` elements for
/// a specific slot, backing an `AttributePlaneReader`.
///
/// # Threading
/// Consumer thread only. All atomic operations use `Relaxed` ordering.
pub struct AttributesReader<'a, const SLOT_SIZE: usize> {
    pub mem: &'a AtomicBuffer,
    pub mem_start_offset: usize,
    pub mem_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> AttributesReader<'a, SLOT_SIZE> {
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + SLOT_SIZE;
        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributesReader::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            SLOT_SIZE
        );
        AttributesReader {
            mem: &mem,
            mem_start_offset,
            mem_end_offset,
        }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "AttributesReader.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }
}
