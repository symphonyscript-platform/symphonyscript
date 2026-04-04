use crate::primitives::hash_table::constants::{EMPTY_HASH, TABLE_SLOT_SIZE};
use crate::primitives::hash_table::table_slot::TableSlot;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct TableSlotView {
    sab: SAB,
    start_index: usize,
    slots_count: u32,
}

impl TableSlotView {
    pub fn new(sab: SAB, start_index: usize, slots_count: u32) -> Self {
        TableSlotView {
            sab,
            start_index,
            slots_count,
        }
    }

    pub fn bind(sab: SAB, start_index: usize, slots_count: u32) -> Self {
        Self::new(sab, start_index, slots_count)
    }

    pub fn get(&self, index: usize) -> TableSlot {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.get | index {} out of bounds",
            index,
        );

        let sab_index = self.calculate_index(index);
        let hash = self.sab[sab_index].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return TableSlot::empty();
        }

        TableSlot {
            hash,
            key: self.sab[sab_index + 1].load(Ordering::Relaxed),
            value: self.sab[sab_index + 2].load(Ordering::Relaxed),
        }
    }

    pub fn set(&self, index: usize, slot: TableSlot) {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.set | index {} out of bounds",
            index,
        );

        let sab_index = self.calculate_index(index);

        self.sab[sab_index].store(slot.hash, Ordering::Relaxed);
        self.sab[sab_index + 1].store(slot.key, Ordering::Relaxed);
        self.sab[sab_index + 2].store(slot.value, Ordering::Relaxed);
    }

    pub fn remove(&self, index: usize) -> TableSlot {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.remove | index {} out of bounds",
            index,
        );

        let sab_index = self.calculate_index(index);
        let hash = self.sab[sab_index].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return TableSlot::empty();
        }

        let slot = TableSlot {
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
        self.start_index + index * TABLE_SLOT_SIZE as usize
    }
}
