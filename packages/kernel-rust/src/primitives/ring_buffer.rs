use crate::errors::ring_buffer_error::RingBufferError;
use crate::primitives::slot_view::SlotView;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct RingBuffer<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    slots: SlotView<SLOT_SIZE>,
    capacity: i32,
    mod_mask: i32,
    read_slot_index: usize,
    write_slot_index: usize,
    pending_slot_index: usize,
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<const SLOT_SIZE: usize> RingBuffer<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32, bind: bool) -> Self {
        let len = 3 + (capacity as usize) * SLOT_SIZE;
        let mem_end_offset = mem_start_offset + len;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "RingBuffer::create | range [{}..{}] exceeds MEM boundaries",
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

        let read_slot_index = mem_start_offset;
        let write_slot_index = mem_start_offset + 1;
        let pending_slot_index = mem_start_offset + 2;

        if !bind {
            mem[read_slot_index].store(0, Ordering::Relaxed);
            mem[write_slot_index].store(0, Ordering::Relaxed);
            mem[pending_slot_index].store(0, Ordering::Relaxed);
        }

        RingBuffer {
            mem: Arc::clone(&mem),
            slots: SlotView::new(Arc::clone(&mem), mem_start_offset + 3, capacity),
            capacity,
            mod_mask: capacity - 1,
            read_slot_index,
            write_slot_index,
            pending_slot_index,
            mem_start_offset,
            mem_end_offset,
        }
    }

    pub fn pending_count(&self) -> i32 {
        self.mem[self.pending_slot_index].load(Ordering::Acquire)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn read(&self) -> Option<[i32; SLOT_SIZE]> {
        let pending_count = self.mem[self.pending_slot_index].load(Ordering::Acquire);

        if pending_count == 0 {
            return None;
        }

        let read_index = self.mem[self.read_slot_index].load(Ordering::Relaxed);
        let entry = self.slots.get(read_index as usize);

        self.mem[self.read_slot_index].store((read_index + 1) & self.mod_mask, Ordering::Relaxed);
        self.mem[self.pending_slot_index].fetch_sub(1, Ordering::Release);

        Some(entry)
    }

    pub fn write(&self, entry: [i32; SLOT_SIZE]) -> Result<(), RingBufferError> {
        let pending_count = self.mem[self.pending_slot_index].load(Ordering::Acquire);

        if pending_count >= self.capacity {
            return Err(RingBufferError::Full);
        }

        let write_index = self.mem[self.write_slot_index].load(Ordering::Relaxed);

        self.slots.set(write_index as usize, entry);
        self.mem[self.write_slot_index].store((write_index + 1) & self.mod_mask, Ordering::Relaxed);
        self.mem[self.pending_slot_index].fetch_add(1, Ordering::Release);

        Ok(())
    }
}
