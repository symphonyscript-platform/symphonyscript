use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct AttributesReader<'a, const SLOT_SIZE: usize> {
    pub(crate) sab: &'a SAB,
    pub(crate) start_index: usize,
}

impl<'a, const SLOT_SIZE: usize> AttributesReader<'a, SLOT_SIZE> {
    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        let end_index = start_index + SLOT_SIZE;
        debug_assert!(end_index < sab.len(), "AttributesReader out of bounds");
        AttributesReader {
            sab: &sab,
            start_index,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
}
