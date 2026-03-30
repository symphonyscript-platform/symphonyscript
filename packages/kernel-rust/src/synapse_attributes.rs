use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

pub struct SynapseAttributesData {
    pub weight: i32,
    pub tick_offset: i32,
    pub transpose: i32,
    pub volume_scale: i32,
    // +16 bytes reserved
}

pub struct SynapseAttributesView<'a> {
    pub(crate) sab: &'a SAB,
    pub(crate) start_index: usize,
}

impl<'a> SynapseAttributesView<'a> {
    pub const SLOT_SIZE: usize = 8;

    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        let end_index = start_index + Self::SLOT_SIZE;
        debug_assert!(end_index < sab.len(), "SynapseAttributesView out of bounds");
        SynapseAttributesView {
            sab: &sab,
            start_index,
        }
    }

    pub fn resolve_sab_index(start_index: usize, offset: usize) -> usize {
        start_index + (offset * SynapseAttributesView::SLOT_SIZE)
    }

    pub fn weight(&self) -> i32 {
        self.read(0)
    }

    pub fn set_weight(&self, value: i32) {
        self.write(0, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.read(1)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.write(1, value)
    }

    pub fn transpose(&self) -> i32 {
        self.read(2)
    }

    pub fn set_transpose(&self, value: i32) {
        self.write(2, value)
    }

    pub fn volume_scale(&self) -> i32 {
        self.read(3)
    }

    pub fn set_volume_scale(&self, value: i32) {
        self.write(3, value)
    }

    fn read(&self, index: usize) -> i32 {
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    fn write(&self, index: usize, value: i32) {
        self.sab[self.start_index + index].store(value, Ordering::Relaxed)
    }
}
