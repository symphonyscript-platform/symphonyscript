use crate::primitives::hash_table::constants::{EMPTY_HASH, TABLE_SLOT_SIZE};
use crate::primitives::hash_table::table_slot::TableSlot;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;

#[derive(Clone)]
pub struct TableSlotView {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    slots_count: u32,
}

impl TableSlotView {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, slots_count: u32) -> Self {
        TableSlotView {
            mem,
            mem_start_offset,
            slots_count,
        }
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, slots_count: u32) -> Self {
        Self::new(mem, mem_start_offset, slots_count)
    }

    pub fn get(&self, index: usize) -> TableSlot {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.get | index {} out of bounds",
            index,
        );

        let mem_offset = self.calculate_index(index);
        let hash = self.mem[mem_offset].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return TableSlot::empty();
        }

        TableSlot {
            hash,
            key: self.mem[mem_offset + 1].load(Ordering::Relaxed),
            value: self.mem[mem_offset + 2].load(Ordering::Relaxed),
        }
    }

    pub fn set(&self, index: usize, slot: TableSlot) {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.set | index {} out of bounds",
            index,
        );

        let mem_offset = self.calculate_index(index);

        self.mem[mem_offset].store(slot.hash, Ordering::Relaxed);
        self.mem[mem_offset + 1].store(slot.key, Ordering::Relaxed);
        self.mem[mem_offset + 2].store(slot.value, Ordering::Relaxed);
    }

    pub fn remove(&self, index: usize) -> TableSlot {
        debug_assert!(
            index < self.slots_count as usize,
            "TableSlotView.remove | index {} out of bounds",
            index,
        );

        let mem_offset = self.calculate_index(index);
        let hash = self.mem[mem_offset].load(Ordering::Relaxed);

        if hash == EMPTY_HASH {
            return TableSlot::empty();
        }

        let slot = TableSlot {
            hash,
            key: self.mem[mem_offset + 1].load(Ordering::Relaxed),
            value: self.mem[mem_offset + 2].load(Ordering::Relaxed),
        };

        self.mem[mem_offset].store(0, Ordering::Relaxed);
        self.mem[mem_offset + 1].store(0, Ordering::Relaxed);
        self.mem[mem_offset + 2].store(0, Ordering::Relaxed);

        slot
    }

    fn calculate_index(&self, index: usize) -> usize {
        self.mem_start_offset + index * TABLE_SLOT_SIZE as usize
    }
}
