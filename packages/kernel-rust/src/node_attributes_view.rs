use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct NodeAttributesView<'a> {
    pub(crate) sab: &'a SAB,
    pub(crate) start_index: usize,
}

impl<'a> NodeAttributesView<'a> {
    pub const SLOT_SIZE: usize = 16;

    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        let end_index = start_index + Self::SLOT_SIZE;
        debug_assert!(end_index < sab.len(), "NodeAttributesView out of bounds");
        NodeAttributesView {
            sab: &sab,
            start_index,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }

    pub fn write(&self, offset: usize, value: i32) {
        self.sab[self.start_index + offset].store(value, Ordering::Relaxed)
    }
}

