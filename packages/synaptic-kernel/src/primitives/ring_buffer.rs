use crate::errors::ring_buffer_error::RingBufferError;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Fixed-capacity SPSC ring buffer with const-generic slot width.
///
/// Each entry is a `[i32; SLOT_SIZE]` array stored inline in the backing `AtomicBuffer`.
/// Uses a bitmask instead of index wrapping instead of modulo.
///
/// # Threading
/// SPSC. One writer, one reader. `pending_count` uses `Acquire`/`Release` to synchronize
/// visibility between `write()` and `read()`/`peek()`.
/// All other atomics use `Relaxed`.
///
/// # Memory Layout
/// ```text
/// Offset          Size            Field
/// ---------------------------------------------
/// 0               1               read_index
/// 1               1               write_index
/// 2               1               pending_count
/// 3               N * S           slots
///
/// N = capacity (power of 2)
/// S = SLOT_SIZE (const generic)
/// ```
///
/// # Constraints
/// - `capacity` must be a power of 2.
/// - `peek()` reads without advancing the read cursor.
/// - `read()` reads and advances.
#[derive(Clone)]
pub struct RingBuffer<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mod_mask: i32,
    capacity: usize,
    mem_start_offset: usize,
    mem_read_offset: usize,
    mem_write_offset: usize,
    mem_pending_offset: usize,
    mem_end_offset: usize,
}

impl<const SLOT_SIZE: usize> RingBuffer<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize, bind: bool) -> Self {
        let len = 3 + capacity * SLOT_SIZE;
        let mem_end_offset = mem_start_offset + len;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "RingBuffer::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            len
        );
        debug_assert!(
            capacity > 0,
            "RingBuffer::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "RingBuffer::create | capacity {} must be power of 2",
            capacity
        );

        let mem_read_offset = mem_start_offset;
        let mem_write_offset = mem_start_offset + 1;
        let mem_pending_offset = mem_start_offset + 2;

        if !bind {
            for i in mem_start_offset..mem_end_offset {
                mem[i].store(0, Ordering::Relaxed);
            }
        }

        RingBuffer {
            mem: Arc::clone(&mem),
            capacity,
            mod_mask: (capacity as i32) - 1,
            mem_read_offset,
            mem_write_offset,
            mem_pending_offset,
            mem_start_offset,
            mem_end_offset,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        3 + capacity * SLOT_SIZE
    }

    pub fn pending_count(&self) -> usize {
        self.mem[self.mem_pending_offset].load(Ordering::Acquire) as usize
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn peek(&self) -> Option<[i32; SLOT_SIZE]> {
        match self.retrieve() {
            Some((data, _)) => Some(data),
            None => None,
        }
    }

    pub fn read(&self) -> Option<[i32; SLOT_SIZE]> {
        match self.retrieve() {
            Some((data, read_offset)) => {
                self.mem[self.mem_read_offset]
                    .store((read_offset + 1) & self.mod_mask, Ordering::Relaxed);
                self.mem[self.mem_pending_offset].fetch_sub(1, Ordering::Release);
                Some(data)
            }
            None => None,
        }
    }

    pub fn write(&self, data: [i32; SLOT_SIZE]) -> Result<(), RingBufferError> {
        let pending_count = self.mem[self.mem_pending_offset].load(Ordering::Acquire) as usize;

        if pending_count >= self.capacity {
            return Err(RingBufferError::Full);
        }

        let write_index = self.mem[self.mem_write_offset].load(Ordering::Relaxed) as usize;
        let mem_slot_base = self.mem_start_offset + 3 + write_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            self.mem[mem_slot_base + i].store(data[i], Ordering::Relaxed)
        }

        self.mem[self.mem_write_offset]
            .store((write_index as i32 + 1) & self.mod_mask, Ordering::Relaxed);
        self.mem[self.mem_pending_offset].fetch_add(1, Ordering::Release);

        Ok(())
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "RingBuffer.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        for i in 0..Self::calculate_size_on_mem(source.capacity) {
            self.mem[self.mem_start_offset + i].store(
                source.mem[source.mem_start_offset + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            );
        }
    }

    fn retrieve(&self) -> Option<([i32; SLOT_SIZE], i32)> {
        let pending_count = self.mem[self.mem_pending_offset].load(Ordering::Acquire);

        if pending_count == 0 {
            return None;
        }

        let read_index = self.mem[self.mem_read_offset].load(Ordering::Relaxed) as usize;

        let mut entry: [i32; SLOT_SIZE] = [0; SLOT_SIZE];
        let mem_slot_base = self.mem_start_offset + 3 + read_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            entry[i] = self.mem[mem_slot_base + i].load(Ordering::Relaxed)
        }

        Some((entry, read_index as i32))
    }
}
