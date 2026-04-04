use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct StagingBuffer {
    sab: SAB,
    capacity: usize,
    start_index: usize,
    len_0_slot_index: usize,
    len_1_slot_index: usize,
    current_list_slot_index: usize,
    list_start_index: usize,
    end_index: usize,
}

pub struct StagingBufferIterator {
    sab: SAB,
    current_index: usize,
    end_index: usize,
}

impl Iterator for StagingBufferIterator {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current_index < self.end_index {
            let slot = self.sab[self.current_index].load(Ordering::Relaxed);
            self.current_index += 1;
            return Some(slot as usize);
        }

        None
    }
}

impl StagingBuffer {
    pub fn new(sab: SAB, start_index: usize, max_slots: usize) -> Self {
        Self::create(sab, start_index, max_slots, false)
    }

    pub fn bind(sab: SAB, start_index: usize, max_slots: usize) -> Self {
        Self::create(sab, start_index, max_slots, true)
    }

    pub fn create(sab: SAB, start_index: usize, capacity: usize, bind: bool) -> Self {
        debug_assert!(capacity > 0, "capacity must be positive");
        debug_assert_eq!(capacity & (capacity - 1), 0, "capacity must be power of 2");

        let len_0_slot_index = start_index;
        let len_1_slot_index = start_index + 1;
        let current_list_slot_index = start_index + 2;
        let list_start_index = start_index + 3;
        let end_index = list_start_index + capacity * 2;

        if !bind {
            sab[current_list_slot_index].store(0, Ordering::Relaxed);
            for i in start_index..end_index {
                sab[i].store(0, Ordering::Relaxed);
            }
        }

        StagingBuffer {
            sab,
            start_index,
            len_0_slot_index,
            len_1_slot_index,
            current_list_slot_index,
            list_start_index,
            end_index,
            capacity,
        }
    }

    pub fn calculate_size_on_sab(max_slots: usize) -> usize {
        3 + max_slots * 2
    }

    pub fn active_count(&self) -> usize {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        self.sab[self.start_index + list_index].load(Ordering::Relaxed) as usize
    }

    pub fn staged_count(&self) -> usize {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        self.sab[self.start_index + prev_index].load(Ordering::Relaxed) as usize
    }

    pub fn len(&self) -> usize {
        self.active_count() + self.staged_count()
    }

    pub fn sab_end_index(&self) -> usize {
        self.end_index
    }

    pub fn push(&self, slot: usize) {
        let len = self.active_count();

        debug_assert!(len < self.capacity, "StagingBuffer overflow");

        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let len_slot_index = self.start_index + list_index;

        self.sab[self.list_start_index + (self.capacity * list_index) + len]
            .store(slot as i32, Ordering::Relaxed);
        self.sab[len_slot_index].store((len as i32) + 1, Ordering::Relaxed);
    }

    pub fn drain(&'_ self) -> StagingBufferIterator {
        let list_index = self.sab[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        let start_index = self.list_start_index + (self.capacity * prev_index);
        let len_slot_index = self.start_index + prev_index;
        let len = self.sab[len_slot_index].load(Ordering::Relaxed) as usize;

        self.sab[len_slot_index].store(0, Ordering::Relaxed);
        self.sab[self.current_list_slot_index].store(prev_index as i32, Ordering::Relaxed);

        StagingBufferIterator {
            sab: Arc::clone(&self.sab),
            current_index: start_index,
            end_index: start_index + len,
        }
    }

    pub fn copy_from(&self, source: &StagingBuffer) {
        debug_assert!(
            source.capacity <= self.capacity,
            "copy_from source cannot be greater than destination"
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
