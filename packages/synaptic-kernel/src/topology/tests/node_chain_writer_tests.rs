use crate::constants::NODE_STRIDE;
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_writer::NodeChainWriter;
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
const HEAD_OFFSET: usize = CAPACITY * NODE_STRIDE;

struct TestHarness {
    mem: AtomicBuffer,
    writer: TripleBufferWriter,
    reader: TripleBufferReader,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    let reader = writer.to_reader();
    TestHarness {
        mem,
        writer,
        reader,
    }
}

// ============ NodeWriter / NodeReader: field accessors ============

#[test]
fn node_writer_set_get_all_fields() {
    let h = setup();
    let chain = NodeChainWriter::<8>::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

    let slot = chain.insert_head(5).unwrap();
    let node = chain.get_node(slot);

    // kind is bit-packed: upper 8 bits of field 0
    assert_eq!(node.get_kind(), 5);

    node.set_outgoing_synapse_head(10);
    assert_eq!(node.get_outgoing_synapse_head(), 10);

    node.set_outgoing_synapse_tail(11);
    assert_eq!(node.get_outgoing_synapse_tail(), 11);

    node.set_incoming_synapse_head(20);
    assert_eq!(node.get_incoming_synapse_head(), 20);

    node.set_incoming_synapse_tail(21);
    assert_eq!(node.get_incoming_synapse_tail(), 21);
}

#[test]
fn node_writer_kind_bitmask_preserves_lower_bits() {
    let h = setup();
    let chain = NodeChainWriter::<8>::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

    let slot = chain.insert_head(0x7F).unwrap();
    let node = chain.get_node(slot);

    // mutate whatever shares field 0's lower 24 bits
    node.set_prev_ptr(0x00FFFFFF);
    let raw = node.get_kind();
    assert_eq!(raw, 0x7F, "kind preserved after mutable field write");
}

#[test]
fn node_reader_sees_writer_data_after_publish() {
    let h = setup();

    let chain =
        NodeChainWriter::<8>::new(h.mem.clone(), h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);
    let slot = {
        let slot = chain.insert_head(12).unwrap();
        let node = chain.get_node(slot);
        node.set_outgoing_synapse_head(99);
        slot
    };
    h.writer.publish();
    h.reader.swap();

    let chain_reader = chain.to_reader();
    let node = chain_reader.get_node(slot);

    assert_eq!(node.get_kind(), 12);
    assert_eq!(node.get_outgoing_synapse_head(), 99);
}

// ============ Data integrity across mutations ============

#[test]
fn uninvolved_node_data_survives_sibling_mutations() {
    let h = setup();
    let chain = NodeChainWriter::<8>::new(h.mem, h.writer.clone(), FL_START, HEAD_OFFSET, CAPACITY);

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    let c = chain.insert_head(3).unwrap();
    // chain: c -> b -> a

    // set custom fields on a
    let node_a = chain.get_node(a);
    node_a.set_outgoing_synapse_head(88);

    // mutate siblings: insert between c and b, then remove b
    let d = chain.insert_after(c, 4).unwrap();
    chain.remove(b).unwrap();
    // chain: c -> d -> a

    // a's data must be completely intact
    let node_a = chain.get_node(a);
    assert_eq!(node_a.get_kind(), 1);
    assert_eq!(node_a.get_outgoing_synapse_head(), 88);
    // a's prev updated from b to d (that's structural, expected)
    assert_eq!(node_a.get_prev_ptr(), d);
}
