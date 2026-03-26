use crate::errors::ring_buffer_error::RingBufferError;
use crate::primitives::slot_view::SlotView;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

pub struct RingBuffer<const SLOT_SIZE: usize> {
    sab: SAB,
    slots: SlotView<SLOT_SIZE>,
    capacity: i32,
    mod_mask: i32,
    read_slot_index: usize,
    write_slot_index: usize,
    pending_slot_index: usize,
    end_index: usize,
}

impl<const SLOT_SIZE: usize> RingBuffer<SLOT_SIZE> {
    pub fn new(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, false)
    }

    pub fn bind(sab: SAB, start_index: usize, capacity: i32) -> Self {
        Self::create(sab, start_index, capacity, true)
    }

    fn create(sab: SAB, start_index: usize, capacity: i32, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity cannot be negative");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");

        let read_slot_index = start_index;
        let write_slot_index = start_index + 1;
        let pending_slot_index = start_index + 2;

        if !bind {
            sab[read_slot_index].store(0, Ordering::Relaxed);
            sab[write_slot_index].store(0, Ordering::Relaxed);
            sab[pending_slot_index].store(0, Ordering::Relaxed);
        }

        RingBuffer {
            sab: Arc::clone(&sab),
            slots: SlotView::new(Arc::clone(&sab), start_index + 3, capacity),
            capacity,
            mod_mask: capacity - 1,
            read_slot_index,
            write_slot_index,
            pending_slot_index,
            end_index: start_index + 3 + (capacity as usize) * SLOT_SIZE,
        }
    }

    pub fn pending_count(&self) -> i32 {
        self.sab[self.pending_slot_index].load(Ordering::Acquire)
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn read(&self) -> Option<[i32; SLOT_SIZE]> {
        let pending_count = self.sab[self.pending_slot_index].load(Ordering::Acquire);

        if pending_count == 0 {
            return None;
        }

        let read_index = self.sab[self.read_slot_index].load(Ordering::Relaxed);
        let entry = self.slots.get(read_index as usize);

        self.sab[self.read_slot_index].store((read_index + 1) & self.mod_mask, Ordering::Relaxed);
        self.sab[self.pending_slot_index].fetch_sub(1, Ordering::Release);

        Some(entry)
    }

    pub fn write(&self, entry: [i32; SLOT_SIZE]) -> Result<(), RingBufferError> {
        let pending_count = self.sab[self.pending_slot_index].load(Ordering::Acquire);

        if pending_count >= self.capacity {
            return Err(RingBufferError::Full);
        }

        let write_index = self.sab[self.write_slot_index].load(Ordering::Relaxed);

        self.slots.set(write_index as usize, entry);
        self.sab[self.write_slot_index].store((write_index + 1) & self.mod_mask, Ordering::Relaxed);
        self.sab[self.pending_slot_index].fetch_add(1, Ordering::Release);

        Ok(())
    }
}
