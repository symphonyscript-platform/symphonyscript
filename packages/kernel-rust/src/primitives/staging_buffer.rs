use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct StagingBuffer {
    sab: SAB,
    capacity: usize,
    sab_start_index: usize,
    len_0_slot_index: usize,
    len_1_slot_index: usize,
    current_list_slot_index: usize,
    list_start_index: usize,
    sab_end_index: usize,
}

pub struct StagingBufferIterator {
    sab: SAB,
    current_index: usize,
    sab_end_index: usize,
}

impl Iterator for StagingBufferIterator {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current_index < self.sab_end_index {
            let slot = self.sab[self.current_index].load(Ordering::Relaxed);
            self.current_index += 1;
            return Some(slot as usize);
        }

        None
    }
}

impl StagingBuffer {
    pub fn new(sab: SAB, sab_start_index: usize, max_slots: usize) -> Self {
        Self::create(sab, sab_start_index, max_slots, false)
    }

    pub fn bind(sab: SAB, sab_start_index: usize, max_slots: usize) -> Self {
        Self::create(sab, sab_start_index, max_slots, true)
    }

    pub fn create(sab: SAB, sab_start_index: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(
            capacity > 0,
            "StagingBuffer::create | capacity {} must be positive",
            capacity
        );
        debug_assert_eq!(
            capacity & (capacity - 1),
            0,
            "StagingBuffer::create | capacity {} must be power of 2",
            capacity
        );

        let len_0_slot_index = sab_start_index;
        let len_1_slot_index = sab_start_index + 1;
        let current_list_slot_index = sab_start_index + 2;
        let list_start_index = sab_start_index + 3;
        let sab_end_index = list_start_index + capacity * 2;

        if !bind {
            sab[current_list_slot_index].store(0, Ordering::Relaxed);
            for i in sab_start_index..sab_end_index {
                sab[i].store(0, Ordering::Relaxed);
            }
        }

        StagingBuffer {
            sab,
            sab_start_index,
            len_0_slot_index,
            len_1_slot_index,
            current_list_slot_index,
            list_start_index,
            sab_end_index,
            capacity,
        }
    }

    pub fn calculate_size_on_sab(max_slots: usize) -> usize {
        3 + max_slots * 2
    }

    pub fn active_count(&self) -> usize {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        self.sab[self.sab_start_index + list_index].load(Ordering::Relaxed) as usize
    }

    pub fn staged_count(&self) -> usize {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        self.sab[self.sab_start_index + prev_index].load(Ordering::Relaxed) as usize
    }

    pub fn len(&self) -> usize {
        self.active_count() + self.staged_count()
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn push(&self, slot: usize) {
        let active_count = self.active_count();

        debug_assert!(
            active_count < self.capacity,
            "StagingBuffer.push | buffer overflow",
        );

        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let len_slot_index = self.sab_start_index + list_index;

        self.sab[self.list_start_index + (self.capacity * list_index) + active_count]
            .store(slot as i32, Ordering::Relaxed);
        self.sab[len_slot_index].store((active_count as i32) + 1, Ordering::Relaxed);
    }

    pub fn drain(&'_ self) -> StagingBufferIterator {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        let sab_start_index = self.list_start_index + (self.capacity * prev_index);
        let len_slot_index = self.sab_start_index + prev_index;
        let len = self.sab[len_slot_index].load(Ordering::Relaxed) as usize;

        self.sab[len_slot_index].store(0, Ordering::Relaxed);
        self.sab[self.current_list_slot_index].store(prev_index as i32, Ordering::Relaxed);

        StagingBufferIterator {
            sab: Arc::clone(&self.sab),
            current_index: sab_start_index,
            sab_end_index: sab_start_index + len,
        }
    }

    pub fn copy_from(&self, source: &StagingBuffer) {
        debug_assert!(
            source.capacity <= self.capacity,
            "StagingBuffer.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        let len_0 = source.sab[source.len_0_slot_index].load(Ordering::Relaxed);
        let len_1 = source.sab[source.len_1_slot_index].load(Ordering::Relaxed);

        self.sab[self.len_0_slot_index].store(len_0, Ordering::Relaxed);
        self.sab[self.len_1_slot_index].store(len_1, Ordering::Relaxed);
        self.sab[self.current_list_slot_index].store(
            source.sab[source.current_list_slot_index].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );

        for i in 0..2 {
            let self_base = self.list_start_index + self.capacity * i;
            let source_base = source.list_start_index + source.capacity * i;
            let len = if i == 0 {
                len_0 as usize
            } else {
                len_1 as usize
            };
            for k in 0..len {
                self.sab[self_base + k].store(
                    source.sab[source_base + k].load(Ordering::Relaxed),
                    Ordering::Relaxed,
                )
            }
        }
    }
}
