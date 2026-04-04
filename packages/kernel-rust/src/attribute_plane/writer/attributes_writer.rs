use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct AttributesWriter<'a, const SLOT_SIZE: usize> {
    pub(crate) sab: &'a SAB,
    pub(crate) sab_start_index: usize,
    pub(crate) sab_end_index: usize,
}

impl<'a, const SLOT_SIZE: usize> AttributesWriter<'a, SLOT_SIZE> {
    pub fn new(sab: &'a SAB, sab_start_index: usize) -> Self {
        let sab_end_index = sab_start_index + SLOT_SIZE;
        debug_assert!(
            sab_end_index <= sab.len(),
            "AttributesWriter::new | range [{}..{}] exceeds SAB boundaries",
            sab_start_index,
            SLOT_SIZE
        );
        AttributesWriter {
            sab: &sab,
            sab_start_index,
            sab_end_index,
        }
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "AttributesWriter.read | offset {} out of bounds",
            offset
        );
        self.sab[self.sab_start_index + offset].load(Ordering::Relaxed)
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < SLOT_SIZE,
            "AttributesWriter.write | offset {} out of bounds",
            offset
        );
        self.sab[self.sab_start_index + offset].store(value, Ordering::Relaxed)
    }
}
