use crate::errors::free_list_error::FreeListError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::structural_plane::slot_writer::SlotWriter;

#[derive(Clone)]
pub struct StructuralWriter<const SLOT_SIZE: usize> {
    writer: TripleBufferWriter,
    free_list: SimpleFreeList,
    start_offset: usize,
    end_offset: usize,
    capacity: usize,
}


impl<const SLOT_SIZE: usize> StructuralWriter<SLOT_SIZE> {
    pub fn new(
        writer: TripleBufferWriter,
        free_list: SimpleFreeList,
        start_offset: usize,
        capacity: usize,
    ) -> Self {
        debug_assert!(
            free_list.capacity() >= capacity,
            "free_list capacity ({}) must be >= capacity ({})",
            free_list.capacity(),
            capacity,
        );

        let end_offset = start_offset + capacity * SLOT_SIZE;

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

    pub fn bind(
        writer: TripleBufferWriter,
        free_list: SimpleFreeList,
        start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::new(writer, free_list, start_offset, capacity)
    }

    pub fn resolve_writer_offset(&self, slot: usize) -> usize {
        self.start_offset + (slot - 1) * SLOT_SIZE
    }

    pub fn end_offset(&self) -> usize {
        self.end_offset
    }

    pub fn capacity(&self) -> usize {
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
        debug_assert!(slot > 0 && slot <= self.capacity(), "slot out of bounds");
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

#[cfg(test)]
mod tests {
    use crate::primitives::into_array::IntoArray;
    use crate::primitives::simple_free_list::SimpleFreeList;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::SAB;
    use crate::structural_plane::structural_writer::StructuralWriter;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_sab(size: usize) -> SAB {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    struct TestPayload {
        a: i32,
        b: i32,
    }

    impl IntoArray<16> for TestPayload {
        fn to_array(&self) -> [i32; 16] {
            let mut data = [0; 16];
            data[0] = self.a;
            data[1] = self.b;
            data
        }
    }

    const SAB_SIZE: usize = 2048;
    const TB_START: usize = 0;
    const TB_BUF_CAP: usize = 256;
    const FL_START: usize = 800;
    const CAPACITY: usize = 8;

    fn setup() -> (
        SAB,
        crate::primitives::triple_buffer::TripleBufferWriter,
        crate::primitives::triple_buffer::TripleBufferReader,
        SimpleFreeList,
    ) {
        let sab = create_sab(SAB_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
        let free_list = SimpleFreeList::new(Arc::clone(&sab), FL_START, CAPACITY);
        (sab, writer, reader, free_list)
    }

    #[test]
    fn get_write_visible_through_read_field() {
        let (_sab, writer, _reader, free_list) = setup();
        let sw: StructuralWriter<16> = StructuralWriter::new(writer.clone(), free_list, 0, CAPACITY);

        let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
        let view = sw.get(slot);
        view.write(7, 54321);

        assert_eq!(
            sw.read_field(slot, 7),
            54321,
            "get().write() must be visible through read_field"
        );
    }
}
