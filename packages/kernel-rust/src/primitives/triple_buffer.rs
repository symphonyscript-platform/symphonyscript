use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use std::sync::Arc;

pub struct TripleBuffer;

#[derive(Clone)]
pub struct TripleBufferWriter {
    sab: SAB,
    start_index: usize,
    state_slot_index: usize,
    writer_slot_index: usize,
    published_slot_index: usize,
    buffer_bases: [usize; 3],
    buffer_capacity: usize,
    end_index: usize,
}

#[derive(Clone)]
pub struct TripleBufferReader {
    sab: SAB,
    start_index: usize,
    state_slot_index: usize,
    reader_slot_index: usize,
    buffer_bases: [usize; 3],
    buffer_capacity: usize,
    end_index: usize,
}

// SPSC TripleBuffer - must be allocated PER main+audio_thread_N pair.
impl TripleBuffer {
    pub fn new(
        sab: SAB,
        start_index: usize,
        buffer_capacity: usize,
    ) -> (TripleBufferWriter, TripleBufferReader) {
        debug_assert!(buffer_capacity > 0, "buffer must have positive capacity");

        let state_slot_index = start_index;
        let writer_slot_index = start_index + 1;
        let published_slot_index = start_index + 2;
        let reader_slot_index = start_index + 3;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_capacity,
            buffers_start_index + buffer_capacity * 2,
        ];
        let end_index = buffers_start_index + buffer_capacity * 3;

        assert!(end_index <= sab.len(), "TripleBuffer out of bounds");

        sab[writer_slot_index].store(0, Ordering::Relaxed);
        sab[state_slot_index].store(0b001, Ordering::Relaxed);
        sab[published_slot_index].store(0, Ordering::Relaxed);
        sab[reader_slot_index].store(2, Ordering::Relaxed);

        let writer = TripleBufferWriter {
            sab: Arc::clone(&sab),
            start_index,
            state_slot_index,
            writer_slot_index,
            published_slot_index,
            buffer_bases,
            buffer_capacity,
            end_index,
        };
        let reader = TripleBufferReader {
            sab: Arc::clone(&sab),
            start_index,
            state_slot_index,
            reader_slot_index,
            buffer_bases,
            buffer_capacity,
            end_index,
        };

        (writer, reader)
    }

    // SAB must already be initialized via new
    pub fn bind_writer(sab: SAB, start_index: usize, buffer_capacity: usize) -> TripleBufferWriter {
        debug_assert!(buffer_capacity > 0, "buffer must have size");

        let state_slot_index = start_index;
        let writer_slot_index = start_index + 1;
        let published_slot_index = start_index + 2;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_capacity,
            buffers_start_index + buffer_capacity * 2,
        ];
        let end_index = buffers_start_index + buffer_capacity * 3;
        let writer = TripleBufferWriter {
            sab: Arc::clone(&sab),
            start_index,
            state_slot_index,
            writer_slot_index,
            published_slot_index,
            buffer_bases,
            buffer_capacity,
            end_index,
        };

        // Synchronize with the last publish() before reading its results.
        sab[state_slot_index].load(Ordering::Acquire);
        let published_index = sab[published_slot_index].load(Ordering::Relaxed);
        let writer_index = sab[writer_slot_index].load(Ordering::Relaxed);
        writer.sync(published_index as usize, writer_index as usize);

        writer
    }

    // SAB must already be initialized via new
    pub fn bind_reader(sab: SAB, start_index: usize, buffer_capacity: usize) -> TripleBufferReader {
        debug_assert!(buffer_capacity > 0, "buffer must have size");

        let state_slot_index = start_index;
        let reader_slot_index = start_index + 3;
        let buffers_start_index = start_index + 4;
        let buffer_bases: [usize; 3] = [
            buffers_start_index,
            buffers_start_index + buffer_capacity,
            buffers_start_index + buffer_capacity * 2,
        ];
        let end_index = buffers_start_index + buffer_capacity * 3;

        TripleBufferReader {
            sab: Arc::clone(&sab),
            start_index,
            state_slot_index,
            reader_slot_index,
            buffer_bases,
            buffer_capacity,
            end_index,
        }
    }

    pub fn calculate_size(frame_capacity: usize) -> usize {
        4 + frame_capacity * 3
    }
}

// Writer - main thread
impl TripleBufferWriter {
    pub fn buffer_capacity(&self) -> usize {
        self.buffer_capacity
    }

    pub fn sab_end_index(&self) -> usize {
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
        self.sync(current_id as usize, writer_new_buffer_id as usize);
    }

    fn sync(&self, published_index: usize, writer_index: usize) {
        if published_index == writer_index {
            return;
        }

        let published_buffer_index = self.buffer_bases[published_index];
        let writer_buffer_index = self.buffer_bases[writer_index];
        let source_ptr = self.sab[published_buffer_index..].as_ptr() as *const i32;
        let destination_ptr = self.sab[writer_buffer_index..].as_ptr() as *mut i32;

        // SAFE: The writer has exclusive ownership of the stale buffer after the swap,
        // and the bounds are validated upon instantiation.
        //
        unsafe {
            std::ptr::copy_nonoverlapping(source_ptr, destination_ptr, self.buffer_capacity);
        }
    }

    pub fn write(&self, offset: usize, value: i32) {
        debug_assert!(offset < self.buffer_capacity, "offset out of bounds");
        let base = self.current_start_index();
        self.sab[base + offset].store(value, Ordering::Relaxed)
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(offset < self.buffer_capacity, "offset out of bounds");
        let base = self.current_start_index();
        self.sab[base + offset].load(Ordering::Relaxed)
    }

    pub fn copy_metadata_from(&self, source: &TripleBufferWriter) {
        self.sab[self.state_slot_index].store(
            source.sab[source.state_slot_index].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.sab[self.writer_slot_index].store(
            source.sab[source.writer_slot_index].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.sab[self.published_slot_index].store(
            source.sab[source.published_slot_index].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.sab[self.published_slot_index + 1].store(
            source.sab[source.published_slot_index + 1].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );

    }

    pub fn copy_region_from(
        &self,
        source: &TripleBufferWriter,
        source_offset: usize,
        destination_offset: usize,
        count: usize,
    ) {
        debug_assert!(
            destination_offset + count <= self.buffer_capacity,
            "copy_region: destination range [{}..{}] exceeds buffer_capacity {}",
            destination_offset,
            count,
            self.buffer_capacity,
        );
        debug_assert!(
            source_offset + count <= self.buffer_capacity,
            "copy_region: source range [{}..{}] exceeds buffer_capacity {}",
            source_offset,
            count,
            source.buffer_capacity,
        );

        for i in 0..3 {
            let self_base = self.buffer_bases[i];
            let source_base = source.buffer_bases[i];
            for k in 0..source.buffer_capacity {
                self.sab[self_base + k].store(
                    source.sab[source_base + k].load(Ordering::Relaxed),
                    Ordering::Relaxed,
                );
            }
        }
    }
}

// Reader - Audio thread
impl TripleBufferReader {
    pub fn buffer_capacity(&self) -> usize {
        self.buffer_capacity
    }

    pub fn sab_end_index(&self) -> usize {
        self.end_index
    }

    pub fn current_start_index(&self) -> usize {
        let buffer_id = self.sab[self.reader_slot_index].load(Ordering::Relaxed) as usize;
        self.buffer_bases[buffer_id]
    }

    pub fn swap(&mut self) -> bool {
        let state = self.sab[self.state_slot_index].load(Ordering::Acquire);

        if state & 0b100 == 0 {
            return false;
        }

        let current_id = self.sab[self.reader_slot_index].load(Ordering::Relaxed);
        let new_state = current_id & 0b011;

        // We use swap instead of CAS because of the following two reasons:
        // 1. the reader's new state is independent of the current shared state.
        // 2. In SPSC, only the reader clears NEW_DATA, so it cannot go 1->0 between
        // the load() above and this swap().
        // The old_state is used to determine which buffer was acquired, since
        // state loaded by the initial load() might be stale by the time we reach this point.
        let old_state = self.sab[self.state_slot_index].swap(new_state, Ordering::Acquire);

        self.sab[self.reader_slot_index].store(old_state & 0b011, Ordering::Relaxed);

        true
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(offset < self.buffer_capacity, "offset out of bounds");
        let base = self.current_start_index();
        self.sab[base + offset].load(Ordering::Relaxed)
    }
}
