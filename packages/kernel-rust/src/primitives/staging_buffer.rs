use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct StagingBuffer {
    mem: AtomicBuffer,
    capacity: usize,
    mem_start_offset: usize,
    len_0_slot_index: usize,
    len_1_slot_index: usize,
    current_list_slot_index: usize,
    list_start_index: usize,
    mem_end_offset: usize,
}

pub struct StagingBufferIterator {
    mem: AtomicBuffer,
    current_index: usize,
    mem_end_offset: usize,
}

impl Iterator for StagingBufferIterator {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        if self.current_index < self.mem_end_offset {
            let slot = self.mem[self.current_index].load(Ordering::Relaxed);
            self.current_index += 1;
            return Some(slot as usize);
        }

        None
    }
}

impl StagingBuffer {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, max_slots: usize) -> Self {
        Self::create(mem, mem_start_offset, max_slots, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, max_slots: usize) -> Self {
        Self::create(mem, mem_start_offset, max_slots, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize, bind: bool) -> Self {
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

        let len_0_slot_index = mem_start_offset;
        let len_1_slot_index = mem_start_offset + 1;
        let current_list_slot_index = mem_start_offset + 2;
        let list_start_index = mem_start_offset + 3;
        let mem_end_offset = list_start_index + capacity * 2;

        if !bind {
            mem[current_list_slot_index].store(0, Ordering::Relaxed);
            for i in mem_start_offset..mem_end_offset {
                mem[i].store(0, Ordering::Relaxed);
            }
        }

        StagingBuffer {
            mem,
            mem_start_offset,
            len_0_slot_index,
            len_1_slot_index,
            current_list_slot_index,
            list_start_index,
            mem_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(max_slots: usize) -> usize {
        3 + max_slots * 2
    }

    pub fn active_count(&self) -> usize {
        let list_index = self.mem[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        self.mem[self.mem_start_offset + list_index].load(Ordering::Relaxed) as usize
    }

    pub fn staged_count(&self) -> usize {
        let list_index = self.mem[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        self.mem[self.mem_start_offset + prev_index].load(Ordering::Relaxed) as usize
    }

    pub fn len(&self) -> usize {
        self.active_count() + self.staged_count()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn push(&self, slot: usize) {
        let active_count = self.active_count();

        debug_assert!(
            active_count < self.capacity,
            "StagingBuffer.push | buffer overflow",
        );

        let list_index = self.mem[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let len_slot_index = self.mem_start_offset + list_index;

        self.mem[self.list_start_index + (self.capacity * list_index) + active_count]
            .store(slot as i32, Ordering::Relaxed);
        self.mem[len_slot_index].store((active_count as i32) + 1, Ordering::Relaxed);
    }

    pub fn drain(&'_ self) -> StagingBufferIterator {
        let list_index = self.mem[self.current_list_slot_index].load(Ordering::Relaxed) as usize;
        let prev_index = 1 - list_index;
        let mem_start_offset = self.list_start_index + (self.capacity * prev_index);
        let len_slot_index = self.mem_start_offset + prev_index;
        let len = self.mem[len_slot_index].load(Ordering::Relaxed) as usize;

        self.mem[len_slot_index].store(0, Ordering::Relaxed);
        self.mem[self.current_list_slot_index].store(prev_index as i32, Ordering::Relaxed);

        StagingBufferIterator {
            mem: Arc::clone(&self.mem),
            current_index: mem_start_offset,
            mem_end_offset: mem_start_offset + len,
        }
    }

    pub fn copy_from(&self, source: &StagingBuffer) {
        debug_assert!(
            source.capacity <= self.capacity,
            "StagingBuffer.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        let len_0 = source.mem[source.len_0_slot_index].load(Ordering::Relaxed);
        let len_1 = source.mem[source.len_1_slot_index].load(Ordering::Relaxed);

        self.mem[self.len_0_slot_index].store(len_0, Ordering::Relaxed);
        self.mem[self.len_1_slot_index].store(len_1, Ordering::Relaxed);
        self.mem[self.current_list_slot_index].store(
            source.mem[source.current_list_slot_index].load(Ordering::Relaxed),
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
                self.mem[self_base + k].store(
                    source.mem[source_base + k].load(Ordering::Relaxed),
                    Ordering::Relaxed,
                )
            }
        }
    }
}
