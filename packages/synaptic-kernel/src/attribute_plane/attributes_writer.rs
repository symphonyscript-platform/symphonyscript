use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

pub struct AttributesWriter<'a, const SLOT_SIZE: usize> {
    pub mem: &'a AtomicBuffer,
    pub mem_start_offset: usize,
    pub mem_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> AttributesWriter<'a, SLOT_SIZE> {
    pub fn new(mem: &'a AtomicBuffer, mem_start_offset: usize) -> Self {
        let mem_end_offset = mem_start_offset + SLOT_SIZE;
        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributesWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            SLOT_SIZE
        );
        AttributesWriter {
            mem: &mem,
            mem_start_offset,
            mem_end_offset,
        }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "AttributesWriter.read | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].load(Ordering::Relaxed)
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < SLOT_SIZE,
            "AttributesWriter.write | offset {} out of bounds",
            offset
        );
        self.mem[self.mem_start_offset + offset].store(value, Ordering::Relaxed)
    }
}
