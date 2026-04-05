use crate::errors::free_list_error::FreeListError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::slot_writer::SlotWriter;
use std::sync::Arc;

#[derive(Clone)]
pub struct TopologyWriter<const SLOT_SIZE: usize> {
    triple_buffer: TripleBufferWriter,
    allocator: SlotAllocator,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const SLOT_SIZE: usize> TopologyWriter<SLOT_SIZE> {
    pub fn new(
        mem: AtomicBuffer,
        writer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            writer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        writer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            writer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        writer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        let tb_end_offset = tb_start_offset + capacity * SLOT_SIZE;

        debug_assert!(
            tb_end_offset <= writer.buffer_capacity(),
            "TopologyWriter::create | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            capacity * SLOT_SIZE,
            writer.buffer_capacity(),
        );

        let allocator = SlotAllocator::create(Arc::clone(&mem), mem_start_offset, capacity, bind);
        let mem_end_offset = allocator.mem_end_offset();

        TopologyWriter {
            triple_buffer: writer,
            allocator,
            mem_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        SlotAllocator::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        capacity * SLOT_SIZE
    }

    // pub fn mem_start_offset(&self) -> usize {
    //     self.mem_start_offset
    // }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    // pub fn tb_start_offset(&self) -> usize {
    //     self.tb_start_offset
    // }
    // 
    // pub fn tb_end_offset(&self) -> usize {
    //     self.tb_end_offset
    // }
    // 
    // pub fn capacity(&self) -> usize {
    //     self.capacity
    // }
    // 
    // pub fn free_count(&self) -> usize {
    //     self.allocator.free_count()
    // }
    // 
    // pub fn deferred_count(&self) -> usize {
    //     self.allocator.deferred_count()
    // }
    // 
    // pub fn count(&self) -> usize {
    //     self.allocator.alloc_count()
    // }
    // 
    // pub fn utilization(&self) -> f32 {
    //     self.allocator.utilization()
    // }

    // pub fn is_active_slot(&self, slot: usize) -> bool {
    //     self.allocator.is_active(slot)
    // }

    // pub fn insert<T: IntoArray<SLOT_SIZE>>(&self, data: T) -> Option<usize> {
    //     match self.allocator.alloc() {
    //         Some(slot) => {
    //             let data = data.to_array();
    //             let base = self.resolve_writer_offset(slot);
    // 
    //             for i in 0..SLOT_SIZE {
    //                 self.triple_buffer.write(base + i, data[i])
    //             }
    // 
    //             Some(slot)
    //         }
    //         None => None,
    //     }
    // }
    // 
    // pub fn defer_free(&self, slot: usize) -> Result<(), FreeListError> {
    //     self.allocator.defer_free(slot)
    // }

    pub fn get(&'_ self, slot: usize) -> SlotWriter<'_, SLOT_SIZE> {
        debug_assert!(
            self.allocator.is_active(slot),
            "TopologyWriter.get | attempted to read inactive slot {}",
            slot
        );
        debug_assert!(
            slot > 0 && slot <= self.capacity(),
            "TopologyWriter.get | slot {} out of bounds",
            slot
        );
        let start_offset = self.resolve_writer_offset(slot);

        SlotWriter::new(&self.triple_buffer, start_offset)
    }

    pub fn write_field(&'_ self, slot: usize, offset: usize, value: i32) {
        debug_assert!(
            self.allocator.is_active(slot),
            "TopologyWriter.write_field | attempted to write inactive slot {}",
            slot
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "TopologyWriter.write_field | slot {} out of bounds",
            offset
        );
        let start_offset = self.resolve_writer_offset(slot);
        self.triple_buffer.write(start_offset + offset, value)
    }

    pub fn read_field(&'_ self, slot: usize, offset: usize) -> i32 {
        debug_assert!(
            self.allocator.is_active(slot),
            "TopologyWriter.read_field | attempted to read inactive slot {}",
            slot
        );
        debug_assert!(
            offset < SLOT_SIZE,
            "TopologyWriter.read_field | slot {} out of bounds",
            offset
        );
        let start_offset = self.resolve_writer_offset(slot);
        self.triple_buffer.read(start_offset + offset)
    }

    pub fn flush_deferred(&mut self) {
        self.allocator.flush_deferred()
    }

    pub fn copy_from(&self, source: &TopologyWriter<SLOT_SIZE>) {
        debug_assert!(
            source.capacity <= self.capacity,
            "TopologyWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.allocator.copy_from(&source.allocator);
        self.triple_buffer.copy_region_from(
            &source.triple_buffer,
            source.tb_start_offset,
            self.tb_start_offset,
            Self::calculate_size_on_tb(source.capacity),
        );
    }

    pub fn resolve_writer_offset(&self, slot: usize) -> usize {
        self.tb_start_offset + (slot - 1) * SLOT_SIZE
    }
}

#[cfg(test)]
mod tests {
    use crate::primitives::into_array::IntoArray;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::AtomicBuffer;
    use crate::topology::topology_writer::TopologyWriter;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_mem(size: usize) -> AtomicBuffer {
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

    const MEM_SIZE: usize = 2048;
    const TB_START: usize = 0;
    const TB_BUF_CAP: usize = 256;
    const FL_START: usize = 800;
    const CAPACITY: usize = 8;

    fn setup() -> (
        AtomicBuffer,
        crate::primitives::triple_buffer::TripleBufferWriter,
        crate::primitives::triple_buffer::TripleBufferReader,
    ) {
        let mem = create_mem(MEM_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
        (mem, writer, reader)
    }

    #[test]
    fn get_write_visible_through_read_field() {
        let (mem, writer, _reader) = setup();
        let sw: TopologyWriter<16> =
            TopologyWriter::new(mem, writer.clone(), FL_START, 0, CAPACITY);

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
