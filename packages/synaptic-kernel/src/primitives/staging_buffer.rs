use crate::errors::ring_buffer_error::RingBufferError;
use crate::primitives::ring_buffer::RingBuffer;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(Clone)]
pub struct StagingBuffer {
    mem: AtomicBuffer,
    buffer: RingBuffer<2>,
    capacity: usize,
    mem_start_offset: usize,
    mem_writer_generation_offset: usize,
    mem_reader_ack_generation_offset: usize,
    mem_end_offset: usize,
}

pub struct StagingBufferIterator<'a> {
    buffer: &'a RingBuffer<2>,
    ack_generation: usize,
}

impl<'a> Iterator for StagingBufferIterator<'a> {
    type Item = usize;

    fn next(&mut self) -> Option<Self::Item> {
        match self.buffer.peek() {
            Some([data, generation]) => {
                if generation as usize > self.ack_generation {
                    return None;
                }

                self.buffer.read();
                Some(data as usize)
            }
            None => None,
        }
    }
}

/**
 * SPSC Staging Buffer
 */
impl StagingBuffer {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
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

        let mem_writer_generation_offset = mem_start_offset;
        let mem_reader_ack_generation_offset = mem_start_offset + 1;
        let mem_list_start_offset = mem_start_offset + 2;
        let mem_end_offset =
            mem_list_start_offset + RingBuffer::<2>::calculate_size_on_mem(capacity);

        debug_assert!(
            mem_end_offset <= mem.len(),
            "StagingBuffer::create | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            mem.len()
        );

        if !bind {
            mem[mem_writer_generation_offset].store(1, Ordering::Relaxed);
            mem[mem_reader_ack_generation_offset].store(0, Ordering::Relaxed);
        }

        let buffer =
            RingBuffer::<2>::create(Arc::clone(&mem), mem_list_start_offset, capacity, bind);

        StagingBuffer {
            mem,
            buffer,
            mem_start_offset,
            mem_writer_generation_offset,
            mem_reader_ack_generation_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        2 + RingBuffer::<2>::calculate_size_on_mem(capacity)
    }

    pub fn len(&self) -> usize {
        self.buffer.pending_count()
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn writer_generation(&self) -> usize {
        self.mem[self.mem_writer_generation_offset].load(Ordering::Relaxed) as usize
    }

    pub fn reader_ack_generation(&self) -> usize {
        self.mem[self.mem_reader_ack_generation_offset].load(Ordering::Acquire) as usize
    }

    pub fn push(&self, slot: usize) -> Result<(), RingBufferError> {
        let len = self.len();

        debug_assert!(len < self.capacity, "StagingBuffer.push | buffer overflow",);

        let generation_id = self.mem[self.mem_writer_generation_offset].load(Ordering::Relaxed);

        self.buffer.write([slot as i32, generation_id])?;

        Ok(())
    }

    pub fn publish(&self) {
        self.mem[self.mem_writer_generation_offset].fetch_add(1, Ordering::Relaxed);
    }

    pub fn drain(&'_ self) -> StagingBufferIterator<'_> {
        StagingBufferIterator {
            buffer: &self.buffer,
            ack_generation: self.reader_ack_generation(),
        }
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "StagingBuffer.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.mem[self.mem_writer_generation_offset].store(
            source.mem[source.mem_writer_generation_offset].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.mem[self.mem_reader_ack_generation_offset].store(
            source.mem[source.mem_reader_ack_generation_offset].load(Ordering::Relaxed),
            Ordering::Relaxed,
        );
        self.buffer.copy_from(&source.buffer);
    }
}
