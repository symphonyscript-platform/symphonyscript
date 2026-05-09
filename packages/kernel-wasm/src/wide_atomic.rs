use synaptic_kernel::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

/// Writes 64-bit value to `mem` as two 32-bit halves.
/// The low half at `offset_i32` and the high half at `offset_i32 + 1`.
///
/// # Concurrency
/// Both stores use `Ordering::Relaxed`. This function does NOT provide
/// atomic access to the i64 pair - concurrent readers may observe torn
/// values (new low with old high, or vice versa) unless "happens-before"
/// is established externally (publish fence, seqlock, or exclusive access).
#[inline]
pub fn mem_write_i64(mem: &AtomicBuffer, offset_i32: usize, value: i64) {
    debug_assert!(
        offset_i32 < mem.len().saturating_sub(1),
        "mem_write_i64 | range [{}..{}] exceeds AtomicBuffer boundaries",
        offset_i32,
        offset_i32.saturating_add(2),
    );
    let lo = value as i32;
    let hi = (value >> 32) as i32;
    mem[offset_i32].store(lo, Ordering::Relaxed);
    mem[offset_i32 + 1].store(hi, Ordering::Relaxed);
}

/// Reads 64-bit value from `mem` previously written by [`mem_write_i64`].
/// Reassembles the i64 from two 32-bit halves: the low half at `offset_i32`
/// and the high half at `offset_i32 + 1`.
///
/// # Concurrency
/// Both loads use `Ordering::Relaxed`. This function does NOT provide
/// atomic access to the i64 pair - If a writer is concurrently active, this
/// read may return a torn value (new low with old high, or vice versa) unless "happens-before"
/// is established externally (publish fence, seqlock, or exclusive access).
#[inline]
pub fn mem_read_i64(mem: &AtomicBuffer, offset_i32: usize) -> i64 {
    debug_assert!(
        offset_i32 < mem.len().saturating_sub(1),
        "mem_read_i64 | range [{}..{}] exceeds AtomicBuffer boundaries",
        offset_i32,
        offset_i32.saturating_add(2),
    );
    let lo = mem[offset_i32].load(Ordering::Relaxed) as u32 as u64;
    let hi = mem[offset_i32 + 1].load(Ordering::Relaxed) as u32 as u64;
    ((hi << 32) | lo) as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn make_mem(n: usize) -> AtomicBuffer {
        Arc::new((0..n).map(|_| AtomicI32::new(0)).collect())
    }

    #[test]
    fn i64_roundtrips_for_representative_values() {
        let mem = make_mem(4);
        let cases = [
            0i64,
            1, -1,
            i64::MIN, i64::MAX,
            0x1_0000_0000, -0x1_0000_0000,
            0x8000_0000_0000_0000u64 as i64,
            0x7FFF_FFFF_FFFF_FFFF,
            0xFFFF_FFFF, // low-half all ones (sign-extension hazard if bug ever returns)
        ];
        for &v in &cases {
            mem_write_i64(&mem, 0, v);
            assert_eq!(mem_read_i64(&mem, 0), v, "round-trip failed for {:#x}", v);
        }
    }

    #[test]
    fn writes_dont_touch_neighboring_slots() {
        let mem = make_mem(4);
        mem[3].store(0xDEAD_BEEFu32 as i32, Ordering::Relaxed);
        mem_write_i64(&mem, 0, -1i64);
        assert_eq!(mem[3].load(Ordering::Relaxed), 0xDEAD_BEEFu32 as i32);
    }

    #[test]
    fn i64_roundtrip_at_nonzero_offset() {
        let mem = make_mem(8);
        mem_write_i64(&mem, 3, 0x1234_5678_9ABC_DEF0u64 as i64);
        assert_eq!(mem_read_i64(&mem, 3), 0x1234_5678_9ABC_DEF0u64 as i64);
        // Slot 0, 1, 2 untouched.
        for i in 0..3 {
            assert_eq!(mem[i].load(Ordering::Relaxed), 0, "slot {} corrupted", i);
        }
        // Slots 5..8 untouched.
        for i in 5..8 {
            assert_eq!(mem[i].load(Ordering::Relaxed), 0, "slot {} corrupted", i);
        }
    }
}
