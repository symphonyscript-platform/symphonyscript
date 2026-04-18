use std::sync::atomic::Ordering;
use crate::attributes::attribute_plane_writer::AttributePlaneWriter;
use crate::attributes::attributes_reader::AttributesReader;
use crate::primitives::types::AtomicBuffer;

/// Readers side of flat attribute storage backed by a shared `AtomicBuffer`.
///
/// Provides independent read access to fixed-size attribute blocks.
///
/// # Threading
/// Consumer thread only. All atomic operations use `Relaxed` ordering.
///
/// # Memory Layout
/// Shares backing region with `AttributePlaneWriter`. See its layout.
///
/// # Constraints
/// - Created exclusively via `AttributePlaneWriter::to_reader()`.
#[derive(Clone)]
pub struct AttributePlaneReader<const STRIDE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const STRIDE: usize> AttributePlaneReader<STRIDE> {
    pub(crate) fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        let mem_end_offset = mem_start_offset + capacity * STRIDE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneReader::bind | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            capacity * STRIDE,
        );

        AttributePlaneReader {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        capacity * STRIDE
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn read(&self, slot: usize, offset: usize) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributePlaneReader.read | offset {} out of bounds",
            offset
        );
        let mem_offset = AttributePlaneWriter::<STRIDE>::resolve_mem_offset(self.mem_start_offset, slot);
        self.mem[mem_offset + offset].load(Ordering::Relaxed)
    }

    pub fn read_all(&self, slot: usize) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(slot, i)
        }

        data
    }

    pub fn get(&'_ self, slot: usize) -> AttributesReader<'_, STRIDE> {
        let mem_offset =
            AttributePlaneWriter::<STRIDE>::resolve_mem_offset(self.mem_start_offset, slot);

        debug_assert!(
            mem_offset + STRIDE <= self.mem_end_offset,
            "AttributePlaneReader.get | slot {} out of bounds",
            slot,
        );

        AttributesReader::new(&self.mem, mem_offset)
    }
}
