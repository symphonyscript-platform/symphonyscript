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

        sab[writer_slot_index].store(0, Ordering::Relaxed);
        sab[state_slot_index].store(0b001, Ordering::Relaxed);
        sab[published_slot_index].store(0, Ordering::Relaxed);
        sab[reader_slot_index].store(2, Ordering::Relaxed);

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

    pub fn bind_writer(sab: SAB, start_index: usize, buffer_size: usize) -> TripleBufferWriter {
        debug_assert!(buffer_size > 0, "buffer must have size");

        let state_slot_index = start_index;
        let writer_slot_index = start_index + 1;
        let published_slot_index = start_index + 2;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_size,
            buffers_start_index + buffer_size * 2,
        ];
        let end_index = buffers_start_index + buffer_size * 3;

        TripleBufferWriter {
            sab: Arc::clone(&sab),
            state_slot_index,
            writer_slot_index,
            published_slot_index,
            buffer_bases,
            buffer_size,
            end_index,
        }
    }

    pub fn bind_reader(sab: SAB, start_index: usize, buffer_size: usize) -> TripleBufferReader {
        debug_assert!(buffer_size > 0, "buffer must have size");

        let state_slot_index = start_index;
        let reader_slot_index = start_index + 3;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_size,
            buffers_start_index + buffer_size * 2,
        ];
        let end_index = buffers_start_index + buffer_size * 3;

        TripleBufferReader {
            sab: Arc::clone(&sab),
            state_slot_index,
            reader_slot_index,
            buffer_bases,
            buffer_size,
            end_index,
        }
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
        let current_id = self.sab[self.writer_slot_index].load(Ordering::Relaxed);
        let new_state = (current_id & 0b011) | 0b100;

        // We use swap instead of CAS because of the following two reasons:
        // 1. the writer's new state is independent of the current shared state
        // - we unconditionally publish our buffer and set NEW_DATA.
        // 2. In SPSC, no competing writers exist, so swap is safe and retry-free.
        let old_state = self.sab[self.state_slot_index].swap(new_state, Ordering::Release);
        let writer_new_buffer_id = old_state & 0b011;

        self.sab[self.writer_slot_index].store(writer_new_buffer_id, Ordering::Relaxed);
        self.sab[self.published_slot_index].store(current_id, Ordering::Relaxed);

        let published_buffer_index = self.buffer_bases[current_id as usize];
        let writer_buffer_index = self.buffer_bases[writer_new_buffer_id as usize];
        let source_ptr = self.sab[published_buffer_index..].as_ptr() as *const i32;
        let destination_ptr = self.sab[writer_buffer_index..].as_ptr() as *mut i32;

        // SAFE: The writer has exclusive ownership of the stale buffer after the swap,
        // and the bounds are validated upon instantiation
        unsafe {
            std::ptr::copy_nonoverlapping(source_ptr, destination_ptr, self.buffer_size);
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
        let state = self.sab[self.state_slot_index].load(Ordering::Relaxed);

        if state & 0b100 == 0 {
            return false;
        }

        let current_id = self.sab[self.reader_slot_index].load(Ordering::Relaxed);
        let new_state = current_id & 0b011;

        // We use swap instead of CAS because of the following two reasons:
        // 1. the readers's new state is independent of the current shared state.
        // 2. In SPSC, only the reader clears NEW_DATA, so it cannot go 1->0 between
        // the load() above and this swap().
        // The old_state is used to determine which buffer was acquired, since
        // state loaded by the initial load() might be stale by the time we reach this point.
        let old_state = self.sab[self.state_slot_index].swap(
            new_state,
            Ordering::Acquire,
        );

        self.sab[self.reader_slot_index].store(old_state & 0b011, Ordering::Relaxed);

        true
    }
}
