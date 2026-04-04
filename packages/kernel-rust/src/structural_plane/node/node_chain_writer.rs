use crate::constants::NODE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::primitives::types::SAB;
use crate::structural_plane::node::node_data::{NodeData, NodeDraft};
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::structural_writer::StructuralWriter;

#[derive(Clone)]
pub struct NodeChainWriter {
    buffer: TripleBufferWriter,
    writer: StructuralWriter<NODE_SLOT_SIZE>,
    sab_start_index: usize,
    sab_end_index: usize,
    triple_buffer_start_offset: usize,
    triple_buffer_end_offset: usize,
    capacity: usize,
}

impl NodeChainWriter {
    pub fn new(
        sab: SAB,
        buffer: TripleBufferWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        debug_assert!(
            triple_buffer_start_offset < buffer.buffer_capacity(),
            "triple_buffer_start_offset ({}) out of bounds",
            triple_buffer_start_offset,
        );

        let structural_writer = StructuralWriter::<NODE_SLOT_SIZE>::new(
            sab,
            buffer.clone(),
            sab_start_index,
            triple_buffer_start_offset + 1,
            capacity,
        );
        let sab_end_index = structural_writer.sab_end_index();
        let triple_buffer_end_offset = structural_writer.triple_buffer_end_offset();

        NodeChainWriter {
            buffer,
            writer: structural_writer,
            sab_start_index,
            sab_end_index,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn bind(
        sab: SAB,
        buffer: TripleBufferWriter,
        sab_start_index: usize,
        triple_buffer_start_offset: usize,
        capacity: usize,
    ) -> Self {
        debug_assert!(
            triple_buffer_start_offset < buffer.buffer_capacity(),
            "triple_buffer_start_offset ({}) out of bounds",
            triple_buffer_start_offset,
        );

        let structural_writer = StructuralWriter::<NODE_SLOT_SIZE>::bind(
            sab,
            buffer.clone(),
            sab_start_index,
            triple_buffer_start_offset + 1,
            capacity,
        );
        let sab_end_index = structural_writer.sab_end_index();
        let triple_buffer_end_offset = structural_writer.triple_buffer_end_offset();

        NodeChainWriter {
            buffer,
            writer: structural_writer,
            sab_start_index,
            sab_end_index,
            triple_buffer_start_offset,
            triple_buffer_end_offset,
            capacity,
        }
    }

    pub fn compute_size_on_sab(capacity: usize) -> usize {
        StructuralWriter::<NODE_SLOT_SIZE>::compute_size_on_sab(capacity)
    }

    pub fn compute_size_on_triple_buffer(capacity: usize) -> usize {
        1 + StructuralWriter::<NODE_SLOT_SIZE>::compute_size_on_triple_buffer(capacity)
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

    pub fn count(&self) -> usize {
        self.writer.count()
    }

    pub fn utilization(&self) -> f32 {
        self.writer.utilization()
    }

    pub fn get_head(&'_ self) -> Option<NodeWriter<'_>> {
        let head_slot = self.buffer.read(self.triple_buffer_start_offset);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeWriter<'_> {
        NodeWriter(self.writer.get(slot))
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        let current_head_slot = self.buffer.read(self.triple_buffer_start_offset);
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
                    .write(self.triple_buffer_start_offset, slot as i32);
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

    pub fn remove(&self, slot: usize) {
        let node = self.get(slot);
        let prev_slot = node.get_prev_ptr();
        let next_slot = node.get_next_ptr();

        if prev_slot != 0 {
            self.get(prev_slot).set_next_ptr(next_slot);
        } else {
            self.buffer
                .write(self.triple_buffer_start_offset, next_slot as i32)
        }

        if next_slot != 0 {
            self.get(next_slot).set_prev_ptr(prev_slot);
        }

        self.writer.defer_free(slot)
    }

    pub fn free_deferred_slots(&mut self) -> Result<(), FreeListError> {
        self.writer.free_deferred_slots()
    }

    pub fn copy_from(&self, source: &NodeChainWriter) {
        debug_assert!(
            source.capacity <= self.capacity,
            "copy_from source cannot be greater than destination"
        );

        self.buffer.copy_region_from(
            &source.buffer,
            source.triple_buffer_start_offset,
            self.triple_buffer_start_offset,
            1,
        );
        self.writer.copy_from(&source.writer);
    }
}

#[cfg(test)]
mod tests {
    use crate::constants::NODE_SLOT_SIZE;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::SAB;
    use crate::structural_plane::node::node_chain_reader::NodeChainReader;
    use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
    use crate::structural_plane::node::node_data::NodeDraft;
    use crate::structural_plane::structural_reader::StructuralReader;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_sab(size: usize) -> SAB {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    // NODE_SLOT_SIZE = 16 (64 bytes per node)
    // Layout: TB metadata (4) + 3 buffers of BUF_CAP each
    // We need space for the chain head pointer inside the TB buffer too
    const SAB_SIZE: usize = 16384;
    const TB_START: usize = 0;
    const TB_BUF_CAP: usize = 4096;
    const FL_START: usize = 13000;
    const CAPACITY: usize = 16;
    // buffer_head_offset: offset within the TB buffer where chain head is stored
    // We put it after the node slots: CAPACITY * NODE_SLOT_SIZE = 16 * 16 = 256
    const NODE_START_OFFSET: usize = 0;
    const HEAD_OFFSET: usize = CAPACITY * NODE_SLOT_SIZE;

    struct TestHarness {
        sab: SAB,
        writer: crate::primitives::triple_buffer::TripleBufferWriter,
        reader: crate::primitives::triple_buffer::TripleBufferReader,
    }

    fn setup() -> TestHarness {
        let sab = create_sab(SAB_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
        TestHarness {
            sab,
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
        let chain = NodeChainWriter::new(h.sab, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

        let slot = chain.insert_head(make_draft(5, 999)).unwrap();
        let node = chain.get(slot);

        // opcode is bit-packed: upper 8 bits of field 0
        assert_eq!(node.get_opcode(), 5);
        assert_eq!(node.get_base_tick(), 999);

        node.set_opcode(42);
        assert_eq!(node.get_opcode(), 42);

        node.set_base_tick(-100);
        assert_eq!(node.get_base_tick(), -100);

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
        let chain = NodeChainWriter::new(h.sab, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

        let slot = chain.insert_head(make_draft(0, 0)).unwrap();
        let node = chain.get(slot);

        // The opcode occupies the top 8 bits of field 0.
        // Lower 24 bits should be preserved across set_opcode calls.
        // Write something to the lower bits via the raw slot view
        node.0.write(0, 0x00FFFFFF); // lower 24 bits all set
        node.set_opcode(0x7F); // max 7-bit opcode

        let raw = node.0.read(0);
        assert_eq!(raw >> 24, 0x7F, "upper 8 bits = opcode");
        assert_eq!(raw & 0x00FFFFFF, 0x00FFFFFF, "lower 24 bits preserved");
    }

    #[test]
    fn node_reader_sees_writer_data_after_publish() {
        let mut h = setup();

        let slot = {
            let chain =
                NodeChainWriter::new(h.sab, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);
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

        let sr =
            StructuralReader::<NODE_SLOT_SIZE>::new(h.reader.clone(), NODE_START_OFFSET, CAPACITY);
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
        let chain = NodeChainWriter::new(h.sab, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

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
        chain.remove(b);
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
