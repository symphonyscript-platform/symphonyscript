use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Producer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read and write access to `STRIDE` elements for
/// a specific slot, backing an `AttributePlaneWriter`.
///
/// # Threading
/// Producer thread only. All atomic operations use `Relaxed` ordering.
pub struct AttributesWriter<'a, const STRIDE: usize> {
    mem: &'a AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<'a, const STRIDE: usize> AttributesWriter<'a, STRIDE> {
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + STRIDE;
        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributesWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            STRIDE
        );
        AttributesWriter {
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

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributesWriter.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < STRIDE,
            "AttributesWriter.write | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].store(value, Ordering::Relaxed)
    }

    pub fn or(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributesWriter.or | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_or(mask, Ordering::Relaxed)
    }

    pub fn and(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributesWriter.and | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_and(mask, Ordering::Relaxed)
    }

    pub fn read_all(&self) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }

    pub fn write_all(&self, data: [i32; STRIDE]) {
        for i in 0..STRIDE {
            self.write(i, data[i]);
        }
    }
}
