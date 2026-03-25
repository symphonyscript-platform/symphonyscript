use crate::errors::table_error::TableError;
use crate::primitives::hash_table::HashTable;
use crate::primitives::slot::Slot;
use crate::primitives::slot_view::SlotView;
use crate::primitives::types::SAB;

pub struct ProbeHashTable {
    slots: SlotView,
    capacity: usize,
    mod_mask: usize,
    shift: u32,
    size: u32,
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
        let capacity =
            ((max_entries as f32 / max_load_factor).ceil() as u32).next_power_of_two() as usize;
        let mod_mask = capacity - 1;
        let shift = 32 - capacity.trailing_zeros();

        ProbeHashTable {
            slots: SlotView::new(sab, start_index, capacity as u32),
            size: 0,
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

    fn compute_displacement(&self, slot: &Slot, index: usize) -> usize {
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
    fn len(&self) -> u32 {
        self.size
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

    fn set(&mut self, key: i32, value: i32) -> Result<(), TableError> {
        let hash = self.compute_hash(key) as i32;
        let mod_hash = hash as usize & self.mod_mask;
        let mut slot_context = Slot { hash, key, value };
        let mut displacement = 0;

        for k in 0..self.capacity {
            let slot_index = (mod_hash + k) & self.mod_mask;
            let slot = self.slots.get(slot_index);

            if slot.is_empty() {
                self.slots.set(slot_index, slot_context);
                self.size += 1;
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

    fn delete(&mut self, key: i32) -> Option<i32> {
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
                self.size -= 1;
                self.backwards_shift(slot_index);
                return Some(slot.value);
            }

            displacement += 1
        }

        None
    }
}
