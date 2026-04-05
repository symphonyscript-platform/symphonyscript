use crate::constants::NODE_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::into_array::IntoArray;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_writer::NodeWriter;
use crate::topology::topology_writer::TopologyWriter;

#[derive(Clone)]
pub struct FramePlaneWriter<const FRAME_SIZE: usize> {
    triple_buffer: TripleBufferWriter,
    topology: TopologyWriter<NODE_SIZE>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl<const FRAME_SIZE: usize> FramePlaneWriter<FRAME_SIZE> {
    pub fn new(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
    ) -> Self {
        Self::create(
            mem,
            buffer,
            mem_start_offset,
            tb_start_offset,
            capacity,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        triple_buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            tb_start_offset < triple_buffer.buffer_capacity(),
            "FramePlaneWriter::create | tb_start_offset {} out of bounds",
            tb_start_offset,
        );

        let topology = TopologyWriter::<NODE_SIZE>::create(
            mem,
            triple_buffer.clone(),
            mem_start_offset,
            tb_start_offset,
            capacity,
            bind,
        );
        let mem_end_offset = topology.mem_end_offset();
        let tb_end_offset = topology.tb_end_offset();

        debug_assert!(
            tb_end_offset <= triple_buffer.buffer_capacity(),
            "FramePlaneWriter::create | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        FramePlaneWriter {
            triple_buffer,
            topology,
            mem_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn calculate_size_on_mem(capacity: usize) -> usize {
        TopologyWriter::<NODE_SIZE>::calculate_size_on_mem(capacity)
    }

    pub fn calculate_size_on_tb(capacity: usize) -> usize {
        1 + TopologyWriter::<NODE_SIZE>::calculate_size_on_tb(capacity)
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn get(&'_ self, slot: usize) -> NodeWriter<'_> {
        NodeWriter(self.topology.get(slot))
    }

    pub fn insert<T: IntoArray<FRAME_SIZE>>(&'_ self, slot: usize, data: T) -> NodeWriter<'_> {
        NodeWriter(self.topology.get(slot))
    }

    pub fn remove(&self, slot: usize) -> Result<(), FreeListError> {
        for i in 0..FRAME_SIZE {
            // @todo: should we bother emptying the slot?
            self.triple_buffer
                .write(self.resolve_slot_start_offset(slot) + i, 0);
        }

        
        Ok(())
    }

    pub fn flush_deferred(&mut self) {
        self.topology.flush_deferred()
    }

    pub fn copy_from(&self, source: &Self) {
        debug_assert!(
            source.capacity <= self.capacity,
            "FramePlaneWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.triple_buffer.copy_region_from(
            &source.triple_buffer,
            source.tb_start_offset,
            self.tb_start_offset,
            1,
        );
        self.topology.copy_from(&source.topology);
    }

    fn resolve_slot_start_offset(&self, slot: usize) -> usize {
        self.tb_start_offset + (slot - 1) * FRAME_SIZE
    }
}
