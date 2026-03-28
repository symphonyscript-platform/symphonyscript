use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

pub struct TripleBuffer;

pub struct TripleBufferWriter {
    sab: SAB,
    state_slot_index: usize,
    writer_slot_index: usize,
    published_slot_index: usize,
    buffer_bases: [usize; 3],
    buffer_size: usize,
    end_index: usize,
}

pub struct TripleBufferReader {
    sab: SAB,
    state_slot_index: usize,
    reader_slot_index: usize,
    buffer_bases: [usize; 3],
    buffer_size: usize,
    end_index: usize,
}

// SPSC TripleBuffer - must be allocated PER main+audio_thread_N pair.
impl TripleBuffer {
    pub fn new(
        sab: SAB,
        start_index: usize,
        buffer_size: usize,
    ) -> (TripleBufferWriter, TripleBufferReader) {
        Self::create(sab, start_index, buffer_size, false)
    }

    pub fn bind(
        sab: SAB,
        start_index: usize,
        buffer_size: usize,
    ) -> (TripleBufferWriter, TripleBufferReader) {
        Self::create(sab, start_index, buffer_size, true)
    }

    fn create(
        sab: SAB,
        start_index: usize,
        buffer_size: usize,
        bind: bool,
    ) -> (TripleBufferWriter, TripleBufferReader) {
        debug_assert!(buffer_size > 0, "buffer must have size");

        let state_slot_index = start_index;
        let writer_slot_index = start_index + 1;
        let published_slot_index = start_index + 2;
        let reader_slot_index = start_index + 3;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_size,
            buffers_start_index + buffer_size * 2,
        ];
        let end_index = buffers_start_index + buffer_size * 3;

        if !bind {
            sab[writer_slot_index].store(0, Ordering::Relaxed);
            sab[state_slot_index].store(0b001, Ordering::Relaxed);
            sab[published_slot_index].store(0, Ordering::Relaxed);
            sab[reader_slot_index].store(2, Ordering::Relaxed);
        }

        let writer = TripleBufferWriter {
            sab: Arc::clone(&sab),
            state_slot_index,
            writer_slot_index,
            published_slot_index,
            buffer_bases,
            buffer_size,
            end_index,
        };
        let reader = TripleBufferReader {
            sab: Arc::clone(&sab),
            state_slot_index,
            reader_slot_index,
            buffer_bases,
            buffer_size,
            end_index,
        };

        (writer, reader)
    }
}

// Writer - main thread
impl TripleBufferWriter {
    pub fn buffer_size(&self) -> usize {
        self.buffer_size
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn current_start_index(&self) -> usize {
        let buffer_id = self.sab[self.writer_slot_index].load(Ordering::Relaxed) as usize;
        self.buffer_bases[buffer_id]
    }

    pub fn publish(&mut self) {
        let mut state = self.sab[self.state_slot_index].load(Ordering::Relaxed);
        let current_id = self.sab[self.writer_slot_index].load(Ordering::Relaxed);
        let new_state = (current_id & 0b011) | 0b100;
        let max_spins = 4;
        let mut spins = 0;

        loop {
            debug_assert!(spins < max_spins, "max spins of 4 exhausted");
            match self.sab[self.state_slot_index].compare_exchange(
                state,
                new_state,
                Ordering::Release,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(actual) => state = actual,
            }

            spins += 1
        }

        let writer_new_buffer_id = state & 0b011;
        self.sab[self.writer_slot_index].store(writer_new_buffer_id, Ordering::Relaxed);
        self.sab[self.published_slot_index].store(current_id, Ordering::Relaxed);

        let published_buffer_index = self.buffer_bases[current_id as usize];
        let writer_buffer_index = self.buffer_bases[writer_new_buffer_id as usize];

        for i in 0..self.buffer_size {
            let data = self.sab[published_buffer_index + i].load(Ordering::Relaxed);
            self.sab[writer_buffer_index + i].store(data, Ordering::Relaxed);
        }
    }
}

// Reader - Audio thread
impl TripleBufferReader {
    pub fn buffer_size(&self) -> usize {
        self.buffer_size
    }

    pub fn end_index(&self) -> usize {
        self.end_index
    }

    pub fn current_start_index(&self) -> usize {
        let buffer_id = self.sab[self.reader_slot_index].load(Ordering::Relaxed) as usize;
        self.buffer_bases[buffer_id]
    }

    pub fn swap(&mut self) -> bool {
        let mut state = self.sab[self.state_slot_index].load(Ordering::Relaxed);

        if state & 0b100 == 0 {
            return false;
        }

        let current_id = self.sab[self.reader_slot_index].load(Ordering::Relaxed);
        let new_state = current_id & 0b011;
        let max_spins = 4;
        let mut spins = 0;

        loop {
            debug_assert!(spins < max_spins, "max spins of 4 exhausted");
            match self.sab[self.state_slot_index].compare_exchange(
                state,
                new_state,
                Ordering::Acquire,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(actual) => state = actual,
            }

            spins += 1
        }

        self.sab[self.reader_slot_index].store(state & 0b011, Ordering::Relaxed);

        true
    }
}
