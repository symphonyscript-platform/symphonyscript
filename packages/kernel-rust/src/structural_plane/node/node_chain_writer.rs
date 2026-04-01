use crate::constants::NODE_SLOT_SIZE;
use crate::errors::free_list_error::FreeListError;
use crate::primitives::triple_buffer::TripleBufferWriter;
use crate::structural_plane::node::node_data::{NodeData, NodeDraft};
use crate::structural_plane::node::node_writer::NodeWriter;
use crate::structural_plane::structural_writer::StructuralWriter;

pub struct NodeChainWriter<'a> {
    buffer: &'a TripleBufferWriter,
    writer: &'a StructuralWriter<'a, NODE_SLOT_SIZE>,
    buffer_head_offset: usize,
}

impl<'a> NodeChainWriter<'a> {
    pub fn new(
        buffer: &'a TripleBufferWriter,
        writer: &'a StructuralWriter<'a, NODE_SLOT_SIZE>,
        buffer_head_offset: usize,
    ) -> Self {
        debug_assert!(
            buffer_head_offset < buffer.buffer_capacity(),
            "buffer_head_offset ({}) out of bounds",
            buffer_head_offset,
        );

        NodeChainWriter {
            buffer,
            writer,
            buffer_head_offset,
        }
    }

    pub fn get_head(&'_ self) -> Option<NodeWriter<'_>> {
        let head_slot = self.buffer.read(self.buffer_head_offset);

        if head_slot == 0 {
            return None;
        }

        Some(self.get(head_slot as usize))
    }

    pub fn get(&'_ self, slot: usize) -> NodeWriter<'_> {
        NodeWriter(self.writer.get(slot))
    }

    pub fn insert_head(&self, data: NodeDraft) -> Option<usize> {
        let current_head_slot = self.buffer.read(self.buffer_head_offset);
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

                self.buffer.write(self.buffer_head_offset, slot as i32);
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

        if prev_slot != 0 {
            self.get(prev_slot).set_next_ptr(next_slot);
        } else {
            self.buffer.write(self.buffer_head_offset, next_slot as i32)
        }

        if next_slot != 0 {
            self.get(next_slot).set_prev_ptr(prev_slot);
        }

        self.writer.free(slot)
    }
}

#[cfg(test)]
mod test {
    use crate::constants::NODE_SLOT_SIZE;
    use crate::primitives::simple_free_list::SimpleFreeList;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::SAB;
    use crate::structural_plane::node::node_chain_reader::NodeChainReader;
    use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
    use crate::structural_plane::node::node_data::NodeDraft;
    use crate::structural_plane::structural_reader::StructuralReader;
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
        _sab: SAB,
        writer: crate::primitives::triple_buffer::TripleBufferWriter,
        reader: crate::primitives::triple_buffer::TripleBufferReader,
        free_list: SimpleFreeList,
    }

    fn setup() -> TestHarness {
        let sab = create_sab(SAB_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
        let free_list = SimpleFreeList::new(Arc::clone(&sab), FL_START, CAPACITY);
        TestHarness {
            _sab: sab,
            writer,
            reader,
            free_list,
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
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
            &h.writer,
            &h.free_list,
            NODE_START_OFFSET,
            CAPACITY,
        );
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

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
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
            &h.writer,
            &h.free_list,
            NODE_START_OFFSET,
            CAPACITY,
        );
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

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
            let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
                &h.writer,
                &h.free_list,
                NODE_START_OFFSET,
                CAPACITY,
            );
            let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);
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

        let sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, CAPACITY);
        let chain_reader = NodeChainReader::new(&h.reader, &sr, HEAD_OFFSET);
        let node = chain_reader.get(slot);

        assert_eq!(node.get_opcode(), 12);
        assert_eq!(node.get_base_tick(), 500);
        assert_eq!(node.get_outgoing_synapse_head(), 99);
    }

    // ============ Data integrity across mutations ============

    #[test]
    fn uninvolved_node_data_survives_sibling_mutations() {
        let h = setup();
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
            &h.writer,
            &h.free_list,
            NODE_START_OFFSET,
            CAPACITY,
        );
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

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
