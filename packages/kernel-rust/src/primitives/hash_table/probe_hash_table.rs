use crate::errors::table_error::TableError;
use crate::primitives::hash_table::constants::TABLE_SLOT_SIZE;
use crate::primitives::hash_table::hash_table_trait::HashTable;
use crate::primitives::hash_table::table_slot::TableSlot;
use crate::primitives::hash_table::table_slot_view::TableSlotView;
use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

pub struct ProbeHashTable {
    sab: SAB,
    slots: TableSlotView,
    capacity: usize,
    mod_mask: usize,
    shift: u32,
    len_index: usize,
    end_index: usize,
    hash: fn(key: i32, shift: u32) -> usize,
}

impl ProbeHashTable {
    pub fn new(
        sab: SAB,
        start_index: usize,
        max_entries: u32,
        max_load_factor: f32,
        hash: fn(key: i32, shift: u32) -> usize,
    ) -> Self {
        Self::create(sab, start_index, max_entries, max_load_factor, hash, false)
    }

    pub fn bind(
        sab: SAB,
        start_index: usize,
        max_entries: u32,
        max_load_factor: f32,
        hash: fn(key: i32, shift: u32) -> usize,
    ) -> Self {
        Self::create(sab, start_index, max_entries, max_load_factor, hash, true)
    }

    fn create(
        sab: SAB,
        start_index: usize,
        max_entries: u32,
        max_load_factor: f32,
        hash: fn(key: i32, shift: u32) -> usize,
        bind: bool,
    ) -> Self {
        let end_index = Self::compute_end_index(start_index, max_entries, max_load_factor);

        assert!(end_index < sab.len(), "ProbeHashTable out of bounds");

        let capacity = Self::compute_capacity(max_entries, max_load_factor);
        let mod_mask = capacity - 1;
        let shift = 32 - capacity.trailing_zeros();
        let slots = TableSlotView::new(Arc::clone(&sab), start_index + 1, capacity as u32);

        if !bind {
            for i in start_index..end_index {
                sab[i].store(0, Ordering::Relaxed);
            }
        }

        ProbeHashTable {
            sab: Arc::clone(&sab),
            slots,
            len_index: start_index,
            end_index,
            capacity,
            mod_mask,
            shift,
            hash,
        }
    }

    fn compute_hash(&self, key: i32) -> usize {
        let hash = (self.hash)(key, self.shift);
        if hash == 0 { 1 } else { hash }
    }

    fn compute_displacement(&self, slot: &TableSlot, index: usize) -> usize {
        index.wrapping_sub(slot.hash as usize) & self.mod_mask
    }

    fn backwards_shift(&self, deleted_slot_index: usize) {
        let start_index = deleted_slot_index + 1;
        let mut gap_index = deleted_slot_index;

        for k in 0..self.capacity {
            let slot_index = (k + start_index) & self.mod_mask;
            let slot = self.slots.get(slot_index);

            if slot.is_empty() {
                return;
            }

            if self.compute_displacement(&slot, slot_index) == 0 {
                return;
            }

            self.slots.set(gap_index, slot);
            self.slots.remove(slot_index);
            gap_index = slot_index;
        }
    }
}

impl HashTable for ProbeHashTable {
    fn compute_capacity(max_entries: u32, max_load_factor: f32) -> usize {
        ((max_entries as f32 / max_load_factor).ceil() as u32).next_power_of_two() as usize
    }

    fn compute_end_index(start_index: usize, max_entries: u32, max_load_factor: f32) -> usize {
        let capacity = Self::compute_capacity(max_entries, max_load_factor);
        start_index + capacity * TABLE_SLOT_SIZE + 1
    }

    fn len(&self) -> i32 {
        self.sab[self.len_index].load(Ordering::Relaxed)
    }

    fn end_index(&self) -> usize {
        self.end_index
    }

    fn get(&self, key: i32) -> Option<i32> {
        let mod_hash = self.compute_hash(key) & self.mod_mask;
        let mut displacement = 0;

        for k in 0..self.capacity {
            let slot_index = (mod_hash + k) & self.mod_mask;
            let slot = self.slots.get(slot_index);

            if slot.is_empty() {
                return None;
            }

            if displacement > self.compute_displacement(&slot, slot_index) {
                return None;
            }

            if key == slot.key {
                return Some(slot.value);
            }

            displacement += 1;
        }

        None
    }

    fn set(&self, key: i32, value: i32) -> Result<(), TableError> {
        let hash = self.compute_hash(key) as i32;
        let mod_hash = hash as usize & self.mod_mask;
        let mut slot_context = TableSlot { hash, key, value };
        let mut displacement = 0;

        for k in 0..self.capacity {
            let slot_index = (mod_hash + k) & self.mod_mask;
            let slot = self.slots.get(slot_index);

            if slot.is_empty() {
                self.slots.set(slot_index, slot_context);
                self.sab[self.len_index].fetch_add(1, Ordering::Relaxed);
                return Ok(());
            } else if slot.key == key {
                self.slots.set(slot_index, slot_context);
                return Ok(());
            }

            let slot_displacement = self.compute_displacement(&slot, slot_index);

            if displacement > slot_displacement {
                self.slots.set(slot_index, slot_context);
                slot_context = slot;
                displacement = slot_displacement;
            }

            displacement += 1
        }

        Err(TableError::Full)
    }

    fn delete(&self, key: i32) -> Option<i32> {
        let mod_hash = self.compute_hash(key) & self.mod_mask;
        let mut displacement = 0;

        for k in 0..self.capacity {
            let slot_index = (k + mod_hash) & self.mod_mask;
            let slot = self.slots.get(slot_index);

            if slot.is_empty() {
                return None;
            }

            if displacement > self.compute_displacement(&slot, slot_index) {
                return None;
            }

            if slot.key == key {
                self.slots.remove(slot_index);
                self.sab[self.len_index].fetch_sub(1, Ordering::Relaxed);
                self.backwards_shift(slot_index);
                return Some(slot.value);
            }

            displacement += 1
        }

        None
    }
}
