use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Consumer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read-only access to `STRIDE` elements.
///
/// # Threading
/// Consumer thread only. All atomic operations use `Relaxed` ordering.
pub struct MemZoneReader<'a> {
    mem: &'a AtomicBuffer,
    pub stride: usize,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<'a> MemZoneReader<'a> {
    #[inline]
    pub fn new(mem: &'a AtomicBuffer, stride: usize, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + stride;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemZoneReader::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            stride
        );

        MemZoneReader {
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
            "MemZoneReader.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    #[inline]
    pub fn read_all<const STRIDE: usize>(&self) -> [i32; STRIDE] {
        debug_assert_eq!(
            STRIDE, self.stride,
            "MemZoneReader::read_all | STRIDE {} must be equal to pre-configured stride {}",
            STRIDE, self.stride
        );

        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }
}
