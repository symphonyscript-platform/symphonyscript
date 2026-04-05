use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct SlotView<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    capacity: i32,
}

impl<const SLOT_SIZE: usize> SlotView<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        debug_assert!(
            capacity > 0,
            "SlotView::new | capacity {} must be positive",
            capacity
        );
        SlotView {
            mem,
            mem_start_offset,
            capacity,
        }
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: i32) -> Self {
        Self::new(mem, mem_start_offset, capacity)
    }

    pub fn mem_offset(&self, slot_index: usize) -> usize {
        self.mem_start_offset + slot_index * SLOT_SIZE
    }

    pub fn get_at(&self, slot_index: usize, offset: usize) -> i32 {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.get_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotView.get_at | offset {} out of bounds",
            offset
        );

        let mem_offset = self.mem_start_offset + slot_index * SLOT_SIZE + offset;

        self.mem[mem_offset].load(Ordering::Relaxed)
    }

    pub fn set_at(&self, slot_index: usize, offset: usize, value: i32) {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.set_at | slot_index {} out of bounds",
            slot_index,
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotView.set_at | slot_item_index {} out of bounds",
            offset
        );

        let mem_offset = self.mem_start_offset + slot_index * SLOT_SIZE + offset;

        self.mem[mem_offset].store(value, Ordering::Relaxed)
    }

    pub fn get(&self, slot_index: usize) -> [i32; SLOT_SIZE] {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.get | slot_index {} out of bounds",
            slot_index,
        );

        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];
        let slot_index = self.mem_start_offset + slot_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            data[i] = self.mem[slot_index + i].load(Ordering::Relaxed)
        }

        data
    }

    pub fn set(&self, slot_index: usize, data: [i32; SLOT_SIZE]) {
        debug_assert!(
            slot_index < self.capacity as usize,
            "SlotView.set | slot_index {} out of bounds",
            slot_index,
        );

        let slot_index = self.mem_start_offset + slot_index * SLOT_SIZE;

        for i in 0..SLOT_SIZE {
            self.mem[slot_index + i].store(data[i], Ordering::Relaxed)
        }
    }
}
