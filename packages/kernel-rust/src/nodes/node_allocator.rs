use crate::primitives::into_array::IntoArray;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct NodeAllocator<'a, const SLOT_SIZE: usize> {
    writer: &'a TripleBufferWriter,
    free_list: &'a SimpleFreeList,
    start_offset: usize,
    end_offset: usize,
    capacity: i32,
}

impl<'a, const SLOT_SIZE: usize> NodeAllocator<'a, SLOT_SIZE> {
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

        NodeAllocator {
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

    pub fn insert_head<T: IntoArray<SLOT_SIZE>>(&self, data: T) -> Option<usize> {
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
}
