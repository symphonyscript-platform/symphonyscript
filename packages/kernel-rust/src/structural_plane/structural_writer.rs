use crate::errors::free_list_error::FreeListError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::structural_plane::slot_writer::SlotWriter;

pub struct StructuralWriter<'a, const SLOT_SIZE: usize> {
    writer: &'a TripleBufferWriter,
    free_list: &'a SimpleFreeList,
    start_offset: usize,
    end_offset: usize,
    capacity: i32,
}

impl<'a, const SLOT_SIZE: usize> StructuralWriter<'a, SLOT_SIZE> {
    pub fn new(
        writer: &'a TripleBufferWriter,
        free_list: &'a SimpleFreeList,
        start_offset: usize,
        capacity: i32,
    ) -> Self {
        debug_assert!(
            free_list.capacity() >= capacity,
            "free_list capacity ({}) must be >= capacity ({})",
            free_list.capacity(),
            capacity,
        );

        let end_offset = start_offset + (capacity as usize) * SLOT_SIZE;

        debug_assert!(
            end_offset <= writer.buffer_capacity(),
            "node region ({}) exceeds writer buffer capacity ({})",
            end_offset,
            writer.buffer_capacity(),
        );

        StructuralWriter {
            writer,
            free_list,
            start_offset,
            end_offset,
            capacity,
        }
    }

    pub fn resolve_writer_offset(&self, slot: usize) -> usize {
        self.start_offset + slot * SLOT_SIZE
    }

    pub fn end_index(&self) -> usize {
        self.end_offset
    }

    pub fn capacity(&self) -> i32 {
        self.capacity
    }

    pub fn insert<T: IntoArray<SLOT_SIZE>>(&self, data: T) -> Option<usize> {
        match self.free_list.alloc() {
            Some(slot) => {
                let data = data.to_array();
                let base = self.resolve_writer_offset(slot);

                for i in 0..SLOT_SIZE {
                    self.writer.write(base + i, data[i])
                }

                Some(slot)
            }
            None => None,
        }
    }

    pub fn free(&self, slot: usize) -> Result<(), FreeListError> {
        self.free_list.free(slot)
    }

    pub fn get(&'_ self, slot: usize) -> SlotWriter<'_, SLOT_SIZE> {
        debug_assert!(slot > 0 && slot <= self.capacity() as usize, "slot out of bounds");
        let start_offset = self.resolve_writer_offset(slot);

        SlotWriter {
            writer: &self.writer,
            start_offset,
        }
    }

    pub fn write_field(&'_ self, slot: usize, offset: usize, value: i32) {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        let start_offset = self.resolve_writer_offset(slot);
        self.writer.write(start_offset + offset, value)
    }

    pub fn read_field(&'_ self, slot: usize, offset: usize) -> i32 {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        let start_offset = self.resolve_writer_offset(slot);
        self.writer.read(start_offset + offset)
    }
}
