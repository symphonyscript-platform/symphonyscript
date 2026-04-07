use synaptic_kernel::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

pub struct SlotHandle<'a, const SLOT_SIZE: usize> {
    mem: &'a AtomicBuffer,
    pub mem_start_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotHandle<'a, SLOT_SIZE> {
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        SlotHandle {
            mem,
            mem_start_offset,
        }
    }

    pub fn bind(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        Self::new(mem, mem_start_offset)
    }

    pub fn read(&self, index: usize) -> i32 {
        debug_assert!(
            index < SLOT_SIZE,
            "SlotHandle.read | index {} out of bounds",
            index
        );
        self.mem[self.mem_start_offset + index].load(Ordering::Relaxed)
    }

    pub fn read_all(&self) -> [i32; SLOT_SIZE] {
        let mut data: [i32; SLOT_SIZE] = [0; SLOT_SIZE];

        for i in 0..SLOT_SIZE {
            data[i] = self.mem[self.mem_start_offset + i].load(Ordering::Relaxed);
        }

        data
    }
    pub fn write(&self, index: usize, value: i32) {
        debug_assert!(
            index < SLOT_SIZE,
            "SlotHandle.write | index {} out of bounds",
            index
        );
        self.mem[self.mem_start_offset + index].store(value, Ordering::Relaxed);
    }

    pub fn write_all(&self, data: [i32; SLOT_SIZE]) {
        for i in 0..SLOT_SIZE {
            self.mem[self.mem_start_offset + i].store(data[i], Ordering::Relaxed);
        }
    }
}
