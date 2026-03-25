use std::sync::atomic::Ordering;
use crate::primitives::constants::{EMPTY_HASH, SLOT_SIZE};
use crate::primitives::slot::Slot;
use crate::primitives::types::SAB;

pub struct SlotView {
    sab: SAB,
    start_index: usize,
    slots_count: u32,
}

impl SlotView {
    pub fn new(sab: SAB, start_index: usize, slots_count: u32) -> Self {
        SlotView {
            sab,
            start_index,
            slots_count,
        }
    }

    pub fn get(&self, index: usize) -> Slot {
        assert!(index < self.slots_count as usize, "slot index out of bounds");

        let sab_index = self.calculate_index(index);
        let hash = self.sab[sab_index].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return Slot::empty()
        }

        Slot {
            hash,
            key: self.sab[sab_index + 1].load(Ordering::Relaxed),
            value: self.sab[sab_index + 2].load(Ordering::Relaxed),
        }
    }

    pub fn set(&self, index: usize, slot: Slot) {
        assert!(index < self.slots_count as usize, "slot index out of bounds");

        let sab_index = self.calculate_index(index);

        self.sab[sab_index].store(slot.hash, Ordering::Relaxed);
        self.sab[sab_index + 1].store(slot.key, Ordering::Relaxed);
        self.sab[sab_index + 2].store(slot.value, Ordering::Relaxed);
    }

    pub fn remove(&self, index: usize) -> Slot {
        assert!(index < self.slots_count as usize, "slot index out of bounds");

        let sab_index = self.calculate_index(index);
        let hash = self.sab[sab_index].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return Slot::empty()
        }

        let slot = Slot {
            hash,
            key: self.sab[sab_index + 1].load(Ordering::Relaxed),
            value: self.sab[sab_index + 2].load(Ordering::Relaxed),
        };

        self.sab[sab_index].store(0, Ordering::Relaxed);
        self.sab[sab_index + 1].store(0, Ordering::Relaxed);
        self.sab[sab_index + 2].store(0, Ordering::Relaxed);

        slot
    }

    fn calculate_index(&self, index: usize) -> usize {
        self.start_index + index * SLOT_SIZE as usize
    }
}
