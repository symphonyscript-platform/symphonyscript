use crate::constants::NODE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::structural_plane::node::node_data::{NodeData, NodeDraft};
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::structural_writer::StructuralWriter;

#[derive(Clone)]
pub struct NodeChainWriter {
    buffer: TripleBufferWriter,
    writer: StructuralWriter<NODE_SLOT_SIZE>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    tb_start_offset: usize,
    tb_end_offset: usize,
    capacity: usize,
}

impl NodeChainWriter {
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
        buffer: TripleBufferWriter,
        mem_start_offset: usize,
        tb_start_offset: usize,
        capacity: usize,
        bind: bool,
    ) -> Self {
        debug_assert!(
            tb_start_offset < buffer.buffer_capacity(),
            "NodeChainWriter::create | tb_start_offset {} out of bounds",
            tb_start_offset,
        );

        let structural_writer = StructuralWriter::<NODE_SLOT_SIZE>::create(
            mem,
            buffer.clone(),
            mem_start_offset,
            tb_start_offset + 1,
            capacity,
            bind,
        );
        let mem_end_offset = structural_writer.mem_end_offset();
        let tb_end_offset = structural_writer.tb_end_offset();

        debug_assert!(
            tb_end_offset <= buffer.buffer_capacity(),
            "NodeChainWriter::create | tb_end_offset {} out of bounds",
            tb_end_offset,
        );

        NodeChainWriter {
            buffer,
            writer: structural_writer,
            mem_start_offset,
            mem_end_offset,
            tb_start_offset,
            tb_end_offset,
            capacity,
        }
    }

    pub fn compute_size_on_mem(capacity: usize) -> usize {
        StructuralWriter::<NODE_SLOT_SIZE>::compute_size_on_mem(capacity)
    }

    pub fn compute_size_on_triple_buffer(capacity: usize) -> usize {
        1 + StructuralWriter::<NODE_SLOT_SIZE>::compute_size_on_triple_buffer(capacity)
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

    pub fn count(&self) -> usize {
        self.writer.count()
    }

    pub fn utilization(&self) -> f32 {
        self.writer.utilization()
    }

    pub fn is_active_slot(&self, slot: usize) -> bool {
        self.writer.is_active_slot(slot)
    }

    pub fn get_head_slot(&self) -> usize {
        self.buffer.read(self.tb_start_offset) as usize
    }

    pub fn get_head(&'_ self) -> Option<NodeWriter<'_>> {
        let head_slot = self.get_head_slot();

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot))
    }

    pub fn get(&'_ self, slot: usize) -> NodeWriter<'_> {
        NodeWriter(self.writer.get(slot))
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        let current_head_slot = self.buffer.read(self.tb_start_offset);
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: 0,
            next_ptr: current_head_slot as usize,
            outgoing_synapse_head: 0,
            outgoing_synapse_tail: 0,
            incoming_synapse_head: 0,
            incoming_synapse_tail: 0,
            mod_head: 0,
        });

        match result {
            Some(slot) => {
                if current_head_slot != 0 {
                    let current_head = self.get(current_head_slot as usize);
                    current_head.set_prev_ptr(slot);
                }

                self.buffer
                    .write(self.tb_start_offset, slot as i32);
                Some(slot)
            }
            None => None,
        }
    }

    pub fn insert_after(&self, prev_slot: usize, data: NodeDraft) -> Option<usize> {
        let prev = self.get(prev_slot);
        let prev_next_slot = prev.get_next_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: prev_slot,
            next_ptr: prev_next_slot,
            outgoing_synapse_head: 0,
            outgoing_synapse_tail: 0,
            incoming_synapse_head: 0,
            incoming_synapse_tail: 0,
            mod_head: 0,
        });

        match result {
            Some(new_slot) => {
                prev.set_next_ptr(new_slot);
                if prev_next_slot != 0 {
                    let prev_next = self.get(prev_next_slot);
                    prev_next.set_prev_ptr(new_slot);
                }
                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn insert_before(&self, next_slot: usize, data: NodeDraft) -> Option<usize> {
        let next = self.get(next_slot);
        let next_prev_slot = next.get_prev_ptr();
        let result = self.writer.insert(NodeData {
            opcode: data.opcode,
            base_tick: data.base_tick,
            prev_ptr: next_prev_slot,
            next_ptr: next_slot,
            outgoing_synapse_head: 0,
            outgoing_synapse_tail: 0,
            incoming_synapse_head: 0,
            incoming_synapse_tail: 0,
            mod_head: 0,
        });

        match result {
            Some(new_slot) => {
                next.set_prev_ptr(new_slot);
                if next_prev_slot != 0 {
                    let next_prev = self.get(next_prev_slot);
                    next_prev.set_next_ptr(new_slot);
                }
                Some(new_slot)
            }
            None => None,
        }
    }

    pub fn remove(&self, slot: usize) -> Result<(), FreeListError> {
        let node = self.get(slot);
        let prev_slot = node.get_prev_ptr();
        let next_slot = node.get_next_ptr();

        self.writer.defer_free(slot)?;

        if prev_slot != 0 {
            self.get(prev_slot).set_next_ptr(next_slot);
        } else {
            self.buffer
                .write(self.tb_start_offset, next_slot as i32)
        }

        if next_slot != 0 {
            self.get(next_slot).set_prev_ptr(prev_slot);
        }

        Ok(())
    }

    pub fn flush_deferred(&mut self) {
        self.writer.flush_deferred()
    }

    pub fn copy_from(&self, source: &NodeChainWriter) {
        debug_assert!(
            source.capacity <= self.capacity,
            "NodeChainWriter.copy_from | source.capacity {} cannot be greater than destination.capacity {}",
            source.capacity,
            self.capacity,
        );

        self.buffer.copy_region_from(
            &source.buffer,
            source.tb_start_offset,
            self.tb_start_offset,
            1,
        );
        self.writer.copy_from(&source.writer);
    }
}

#[cfg(test)]
mod tests {
    use crate::constants::NODE_SLOT_SIZE;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::AtomicBuffer;
    use crate::structural_plane::node::node_chain_reader::NodeChainReader;
    use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
    use crate::structural_plane::node::node_data::NodeDraft;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_mem(size: usize) -> AtomicBuffer {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    // NODE_SLOT_SIZE = 16 (64 bytes per node)
    // Layout: TB metadata (4) + 3 buffers of BUF_CAP each
    // We need space for the chain head pointer inside the TB buffer too
    const MEM_SIZE: usize = 16384;
    const TB_START: usize = 0;
    const TB_BUF_CAP: usize = 4096;
    const FL_START: usize = 13000;
    const CAPACITY: usize = 16;
    const HEAD_OFFSET: usize = CAPACITY * NODE_SLOT_SIZE;

    struct TestHarness {
        mem: AtomicBuffer,
        writer: crate::primitives::triple_buffer::TripleBufferWriter,
        reader: crate::primitives::triple_buffer::TripleBufferReader,
    }

    fn setup() -> TestHarness {
        let mem = create_mem(MEM_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
        TestHarness {
            mem,
            writer,
            reader,
        }
    }

    fn make_draft(opcode: i32, tick: i32) -> NodeDraft {
        NodeDraft {
            opcode,
            base_tick: tick,
        }
    }

    // ============ NodeWriter / NodeReader: field accessors ============

    #[test]
    fn node_writer_set_get_all_fields() {
        let h = setup();
        let chain = NodeChainWriter::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

        let slot = chain.insert_head(make_draft(5, 999)).unwrap();
        let node = chain.get(slot);

        // opcode is bit-packed: upper 8 bits of field 0
        assert_eq!(node.get_opcode(), 5);
        assert_eq!(node.get_base_tick(), 999);

        node.set_outgoing_synapse_head(10);
        assert_eq!(node.get_outgoing_synapse_head(), 10);

        node.set_outgoing_synapse_tail(11);
        assert_eq!(node.get_outgoing_synapse_tail(), 11);

        node.set_incoming_synapse_head(20);
        assert_eq!(node.get_incoming_synapse_head(), 20);

        node.set_incoming_synapse_tail(21);
        assert_eq!(node.get_incoming_synapse_tail(), 21);

        node.set_mod_head(77);
        assert_eq!(node.get_mod_head(), 77);
    }

    #[test]
    fn node_writer_opcode_bitmask_preserves_lower_bits() {
        let h = setup();
        let chain = NodeChainWriter::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

        let slot = chain.insert_head(make_draft(0x7F, 0)).unwrap();
        let node = chain.get(slot);

        // mutate whatever shares field 0's lower 24 bits
        node.set_prev_ptr(0x00FFFFFF);
        let raw = node.0.read(0);
        assert_eq!(
            raw >> 24,
            0x7F,
            "opcode preserved after mutable field write"
        );
    }

    #[test]
    fn node_reader_sees_writer_data_after_publish() {
        let mut h = setup();

        let slot = {
            let chain =
                NodeChainWriter::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);
            let slot = chain
                .insert_head(NodeDraft {
                    opcode: 12,
                    base_tick: 500,
                })
                .unwrap();
            let node = chain.get(slot);
            node.set_outgoing_synapse_head(99);
            slot
        };
        h.writer.publish();
        h.reader.swap();

        let chain_reader = NodeChainReader::new(h.reader.clone(), HEAD_OFFSET, CAPACITY);
        let node = chain_reader.get(slot);

        assert_eq!(node.get_opcode(), 12);
        assert_eq!(node.get_base_tick(), 500);
        assert_eq!(node.get_outgoing_synapse_head(), 99);
    }

    // ============ Data integrity across mutations ============

    #[test]
    fn uninvolved_node_data_survives_sibling_mutations() {
        let h = setup();
        let chain = NodeChainWriter::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

        let a = chain.insert_head(make_draft(1, 100)).unwrap();
        let b = chain.insert_head(make_draft(2, 200)).unwrap();
        let c = chain.insert_head(make_draft(3, 300)).unwrap();
        // chain: c -> b -> a

        // set custom fields on a
        let node_a = chain.get(a);
        node_a.set_mod_head(77);
        node_a.set_outgoing_synapse_head(88);

        // mutate siblings: insert between c and b, then remove b
        let d = chain.insert_after(c, make_draft(4, 400)).unwrap();
        chain.remove(b).unwrap();
        // chain: c -> d -> a

        // a's data must be completely intact
        let node_a = chain.get(a);
        assert_eq!(node_a.get_opcode(), 1);
        assert_eq!(node_a.get_base_tick(), 100);
        assert_eq!(node_a.get_mod_head(), 77);
        assert_eq!(node_a.get_outgoing_synapse_head(), 88);
        // a's prev updated from b to d (that's structural, expected)
        assert_eq!(node_a.get_prev_ptr(), d);
    }
}
