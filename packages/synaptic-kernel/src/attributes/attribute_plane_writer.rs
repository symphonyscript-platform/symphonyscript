use crate::attributes::attribute_plane_reader::AttributePlaneReader;
use crate::attributes::attributes_writer::AttributesWriter;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Producer-side of flat attribute storage backed by a shared `AtomicBuffer`.
///
/// Each slot holds a fixed `[i32; STRIDE]` attribute block.
/// Slots are 1-based (indexed same as the `SlotAllocator`).
/// Lives on the `mem` (direct) plane - not triple-buffered.
/// Attribute writes are immediately visible to the consumer.
///
/// # Threading
/// Producer thread only. All atomic operations use `Relaxed` ordering.
///
/// # Memory Layout
/// ```text
/// Offset          Size            Field
/// -------------------------------------
/// 0               N * S           slots
///
/// N = capacity
/// S = STRIDE (const generic)
/// ```
///
/// # Constraints
/// - 1-based slot indexing.
/// - Use `to_reader()` to create the paired `AttributePlaneReader`.
#[derive(Clone)]
pub struct AttributePlaneWriter<const STRIDE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const STRIDE: usize> AttributePlaneWriter<STRIDE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        mem_start_offset: usize,
        capacity: usize,
        _bind: bool, // reserved for possible future use
    ) -> Self {
        let mem_end_offset = mem_start_offset + capacity * STRIDE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            capacity * STRIDE
        );

        AttributePlaneWriter {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn resolve_mem_offset(mem_start_offset: usize, slot: usize) -> usize {
        debug_assert!(
            slot > 0,
            "AttributePlaneWriter::resolve_mem_offset | slot {} out of bounds",
            slot
        );
        mem_start_offset + ((slot - 1) * STRIDE)
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        capacity * STRIDE
    }

    pub fn to_reader(&self) -> AttributePlaneReader<STRIDE> {
        AttributePlaneReader::bind(Arc::clone(&self.mem), self.mem_start_offset, self.capacity)
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
            "AttributePlaneWriter.read | offset {} out of bounds",
            offset
        );
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);
        self.mem[mem_offset + offset].load(Ordering::Relaxed)
    }

    pub fn write(&self, slot: usize, offset: usize, value: i32) {
        debug_assert!(
            offset < STRIDE,
            "AttributePlaneWriter.write | offset {} out of bounds",
            offset
        );
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);
        self.mem[mem_offset + offset].store(value, Ordering::Relaxed)
    }

    pub fn or(&self, slot: usize, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributePlaneWriter.or | offset {} out of bounds",
            offset
        );
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);
        self.mem[mem_offset + offset].fetch_or(mask, Ordering::Relaxed)
    }

    pub fn and(&self, slot: usize, offset: usize, mask: i32) -> i32 {
        debug_assert!(
            offset < STRIDE,
            "AttributePlaneWriter.and | offset {} out of bounds",
            offset
        );
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);
        self.mem[mem_offset + offset].fetch_and(mask, Ordering::Relaxed)
    }

    pub fn read_all(&self, slot: usize) -> [i32; STRIDE] {
        let mut data: [i32; STRIDE] = [0; STRIDE];

        for i in 0..STRIDE {
            data[i] = self.read(slot, i)
        }

        data
    }

    pub fn write_all(&self, slot: usize, data: [i32; STRIDE]) {
        for i in 0..STRIDE {
            self.write(slot, i, data[i]);
        }
    }

    pub fn get(&'_ self, slot: usize) -> AttributesWriter<'_, STRIDE> {
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);

        debug_assert!(
            mem_offset + STRIDE <= self.mem_end_offset,
            "AttributePlaneWriter.get | slot {} out of bounds",
            slot,
        );

        AttributesWriter::new(&self.mem, mem_offset)
    }

    pub fn set<T: IntoArray<STRIDE>>(&self, slot: usize, data: T) {
        let attrs = self.get(slot);
        let data = data.to_array();

        for i in 0..STRIDE {
            attrs.write(i, data[i]);
        }
    }

    pub fn clear(&self, slot: usize) {
        let attrs = self.get(slot);

        for i in 0..STRIDE {
            attrs.write(i, 0);
        }
    }

    pub fn copy_from(&self, source: &AttributePlaneWriter<STRIDE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "AttributePlaneWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        for i in 0..source.capacity * STRIDE {
            self.mem[self.mem_start_offset + i].store(
                source.mem[source.mem_start_offset + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }
}
