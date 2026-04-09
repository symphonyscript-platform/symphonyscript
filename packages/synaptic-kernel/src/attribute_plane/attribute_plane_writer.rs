use crate::attribute_plane::attribute_plane_reader::AttributePlaneReader;
use crate::attribute_plane::attributes_writer::AttributesWriter;
use crate::primitives::into_array::IntoArray;
use crate::primitives::types::AtomicBuffer;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Writer side of flat attribute storage backed by a shared `AtomicBuffer`.
///
/// Each slot holds a fixed `[i32; SLOT_SIZE]` attribute block.
/// Slots are 1-based (indexed same as the `SlotAllocator`).
/// Lives on the `mem` (direct) plane - not triple-buffered.
/// Attribute writes are immediately visible to the reader.
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
/// S = SLOT_SIZE (const generic)
/// ```
///
/// # Constraints
/// - 1-based slot indexing.
/// - Use `to_reader()` to create the paired `AttributePlaneReader`.
#[derive(Clone)]
pub struct AttributePlaneWriter<const SLOT_SIZE: usize> {
    mem: AtomicBuffer,
    mem_start_offset: usize,
    mem_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> AttributePlaneWriter<SLOT_SIZE> {
    pub fn new(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, false)
    }

    pub fn bind(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize) -> Self {
        Self::create(mem, mem_start_offset, capacity, true)
    }

    pub fn create(mem: AtomicBuffer, mem_start_offset: usize, capacity: usize, bind: bool) -> Self {
        let mem_end_offset = mem_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            mem_end_offset <= mem.len(),
            "AttributePlaneWriter::new | range [{}..{}] exceeds AtomicBuffer boundaries",
            mem_start_offset,
            capacity * SLOT_SIZE
        );

        AttributePlaneWriter {
            mem,
            mem_start_offset,
            mem_end_offset,
            capacity,
        }
    }

    pub fn resolve_mem_offset(mem_start_offset: usize, slot: usize) -> usize {
        mem_start_offset + ((slot - 1) * SLOT_SIZE)
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn to_reader(&self) -> AttributePlaneReader<SLOT_SIZE> {
        AttributePlaneReader::bind(Arc::clone(&self.mem), self.mem_start_offset, self.capacity)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&'_ self, slot: usize) -> AttributesWriter<'_, SLOT_SIZE> {
        let mem_offset = Self::resolve_mem_offset(self.mem_start_offset, slot);

        debug_assert!(
            mem_offset + SLOT_SIZE <= self.mem_end_offset,
            "AttributePlaneWriter.get | slot {} out of bounds",
            slot,
        );

        AttributesWriter::new(&self.mem, mem_offset)
    }

    pub fn set<T: IntoArray<SLOT_SIZE>>(&self, slot: usize, data: T) {
        let attrs = self.get(slot);
        let data = data.to_array();

        for i in 0..SLOT_SIZE {
            attrs.set(i, data[i]);
        }
    }

    pub fn clear(&self, slot: usize) {
        let attrs = self.get(slot);

        for i in 0..SLOT_SIZE {
            attrs.set(i, 0);
        }
    }

    pub fn copy_from(&self, source: &AttributePlaneWriter<SLOT_SIZE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "AttributePlaneWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        for i in 0..source.capacity * SLOT_SIZE {
            self.mem[self.mem_start_offset + i].store(
                source.mem[source.mem_start_offset + i].load(Ordering::Relaxed),
                Ordering::Relaxed,
            )
        }
    }
}
