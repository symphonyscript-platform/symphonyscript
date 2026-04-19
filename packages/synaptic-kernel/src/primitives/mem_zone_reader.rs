use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Consumer-side view into a single, fixed-size attribute block on a shared `AtomicBuffer`.
///
/// Provides 0-based read-only access to `STRIDE` elements.
///
/// # Threading
/// Consumer thread only. All atomic operations use `Relaxed` ordering.
pub struct MemZoneReader<'a, const STRIDE: usize> {
    mem: &'a AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<'a, const STRIDE: usize> MemZoneReader<'a, STRIDE> {
    #[inline]
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + STRIDE;
        debug_assert!(
            mem_end_offset <= mem.len(),
            "MemZoneReader::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            STRIDE
        );
        MemZoneReader {
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
            "MemZoneReader.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    #[inline]
    pub fn read_all(&self) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(i)
        }

        data
    }
}
