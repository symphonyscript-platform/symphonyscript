use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Producer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read and write access to `STRIDE` elements.
///
/// # Threading
/// Producer thread only. All atomic operations use `Relaxed` ordering.
pub struct MemZoneWriter<'a> {
    mem: &'a AtomicBuffer,
    pub stride: usize,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<'a> MemZoneWriter<'a> {
    #[inline]
    pub fn new(mem: &'a AtomicBuffer, stride: usize, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + stride;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemZoneWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            stride
        );

        MemZoneWriter {
            mem,
            stride,
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
            offset < self.stride,
            "MemZoneWriter.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    #[inline]
    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < self.stride,
            "MemZoneWriter.write | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].store(value, Ordering::Relaxed)
    }

    #[inline]
    pub fn or(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < self.stride,
            "MemZoneWriter.or | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_or(mask, Ordering::Relaxed)
    }

    #[inline]
    pub fn and(&self, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < self.stride,
            "MemZoneWriter.and | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].fetch_and(mask, Ordering::Relaxed)
    }

    #[inline]
    pub fn read_all<const STRIDE: usize>(&self) -> [i32; STRIDE] {
        debug_assert_eq!(
            STRIDE, self.stride,
            "MemZoneWriter::read_all | STRIDE {} must be equal to pre-configured stride {}",
            STRIDE, self.stride
        );

        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }

    #[inline]
    pub fn write_all<const STRIDE: usize>(&self, data: [i32; STRIDE]) {
        debug_assert_eq!(
            STRIDE, self.stride,
            "MemZoneWriter::write_all | STRIDE {} must be equal to pre-configured stride {}",
            STRIDE, self.stride
        );

        for i in 0..STRIDE {
            self.write(i, data[i]);
        }
    }

    #[inline]
    pub fn clear<const STRIDE: usize>(&self) {
        debug_assert_eq!(
            STRIDE, self.stride,
            "MemZoneWriter::clear | STRIDE {} must be equal to pre-configured stride {}",
            STRIDE, self.stride
        );

        self.write_all([0; STRIDE]);
    }
}
