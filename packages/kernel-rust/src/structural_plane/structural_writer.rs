use crate::errors::free_list_error::FreeListError;
use crate::primitives::deferred_frees_list::DeferredFreesList;
use crate::primitives::into_array::IntoArray;
use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::SAB;
use crate::structural_plane::slot_writer::SlotWriter;
use std::sync::Arc;

#[derive(Clone)]
pub struct StructuralWriter<const SLOT_SIZE: usize> {
    writer: TripleBufferWriter,
    free_list: SimpleFreeList,
    deferred_frees_list: DeferredFreesList,
    sab_start_index: usize,
    sab_end_index: usize,
    triple_buffer_start_offset: usize,
    triple_buffer_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> StructuralWriter<SLOT_SIZE> {
    pub fn new(
        sab: SAB,
        writer: TripleBufferWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let triple_buffer_end_offset = triple_buffer_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            triple_buffer_end_offset <= writer.buffer_capacity(),
            "node region ({}) exceeds writer buffer capacity ({})",
            triple_buffer_end_offset,
            writer.buffer_capacity(),
        );

        let free_list = SimpleFreeList::new(Arc::clone(&sab), sab_start_index, capacity);
        let deferred_frees_list =
            DeferredFreesList::new(Arc::clone(&sab), free_list.sab_end_index(), capacity);
        let sab_end_index = deferred_frees_list.sab_end_index();

        StructuralWriter {
            writer,
            free_list,
            deferred_frees_list,
            sab_start_index,
            sab_end_index,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn bind(
        sab: SAB,
        writer: TripleBufferWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        let triple_buffer_end_offset = triple_buffer_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            triple_buffer_end_offset <= writer.buffer_capacity(),
            "node region ({}) exceeds writer buffer capacity ({})",
            triple_buffer_end_offset,
            writer.buffer_capacity(),
        );

        let free_list = SimpleFreeList::bind(Arc::clone(&sab), sab_start_index, capacity);
        let deferred_frees_list =
            DeferredFreesList::bind(Arc::clone(&sab), free_list.sab_end_index(), capacity);
        let sab_end_index = deferred_frees_list.sab_end_index();

        StructuralWriter {
            writer,
            free_list,
            deferred_frees_list,
            sab_start_index,
            sab_end_index,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn compute_size_on_sab(capacity: usize) -> usize {
        SimpleFreeList::calculate_size(capacity) + DeferredFreesList::calculate_size(capacity)
    }

    pub fn compute_size_on_triple_buffer(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    pub fn sab_start_index(&self) -> usize {
        self.sab_start_index
    }

    pub fn sab_end_index(&self) -> usize {
        self.sab_end_index
    }

    pub fn triple_buffer_start_offset(&self) -> usize {
        self.triple_buffer_start_offset
    }

    pub fn triple_buffer_end_offset(&self) -> usize {
        self.triple_buffer_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn free_count(&self) -> usize {
        self.free_list.free_count()
    }

    pub fn count(&self) -> usize {
        self.free_list.alloc_count()
    }

    pub fn utilization(&self) -> f32 {
        self.free_list.utilization()
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

    pub fn defer_free(&self, slot: usize) {
        self.deferred_frees_list.push(slot)
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

    pub fn free_deferred_slots(&mut self) -> Result<(), FreeListError> {
        self.deferred_frees_list
            .free_deferred_slots(&self.free_list)
    }

    pub fn copy_from(&self, source: &StructuralWriter<SLOT_SIZE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "copy_from source cannot be greater than destination"
        );

        self.free_list.copy_from(&source.free_list);
        self.deferred_frees_list
            .copy_from(&source.deferred_frees_list);
        self.writer.copy_region_from(
            &source.writer,
            source.triple_buffer_start_offset,
            self.triple_buffer_start_offset,
            Self::compute_size_on_triple_buffer(source.capacity),
        );
    }

    fn resolve_writer_offset(&self, slot: usize) -> usize {
        self.triple_buffer_start_offset + (slot - 1) * SLOT_SIZE
    }
}

#[cfg(test)]
mod tests {
    use crate::primitives::into_array::IntoArray;
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
    ) {
        let sab = create_sab(SAB_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
        (sab, writer, reader)
    }

    #[test]
    fn get_write_visible_through_read_field() {
        let (sab, writer, _reader) = setup();
        let sw: StructuralWriter<16> =
            StructuralWriter::new(sab, writer.clone(), FL_START, 0, CAPACITY);

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
