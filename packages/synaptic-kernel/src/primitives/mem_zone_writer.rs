use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Producer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read and write access to `STRIDE` elements.
///
/// # Threading
/// Producer thread only. All atomic operations use `Relaxed` ordering.
pub struct MemZoneWriter<'a, const STRIDE: usize> {
    mem: &'a AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<'a, const STRIDE: usize> MemZoneWriter<'a, STRIDE> {
    #[inline]
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + STRIDE;
        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemZoneWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            STRIDE
        );
        MemZoneWriter {
            mem,
            mem_start_offset,
            mem_end_offset,
        }
    }

    #[inline]
    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    #[inline]
    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    #[inline]
    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "MemZoneWriter.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    #[inline]
    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < STRIDE,
            "MemZoneWriter.write | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].store(value, Ordering::Relaxed)
    }

    #[inline]
    pub fn or(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "MemZoneWriter.or | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_or(mask, Ordering::Relaxed)
    }

    #[inline]
    pub fn and(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "MemZoneWriter.and | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_and(mask, Ordering::Relaxed)
    }

    #[inline]
    pub fn read_all(&self) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }

    #[inline]
    pub fn write_all(&self, data: [i32; STRIDE]) {
        for i in 0..STRIDE {
            self.write(i, data[i]);
        }
    }

    #[inline]
    pub fn clear(&self) {
        self.write_all([0; STRIDE]);
    }
}
