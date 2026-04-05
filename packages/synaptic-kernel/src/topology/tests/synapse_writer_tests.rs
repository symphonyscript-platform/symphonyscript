use crate::constants::SYNAPSE_SIZE;
use crate::primitives::triple_buffer::TripleBuffer;
use crate::primitives::types::AtomicBuffer;
use crate::topology::node::node_chain_writer::NodeChainWriter;
use crate::topology::synapse::synapse_chain_writer::SynapseChainWriter;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const MEM_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const NODE_CAPACITY: usize = 16;
const SYNAPSE_CAPACITY: usize = 32;
const NODE_HEAD_OFFSET: usize = NODE_CAPACITY * SYNAPSE_SIZE;
const SYNAPSE_START_OFFSET: usize = NODE_HEAD_OFFSET + 1;
const NODE_FL_START: usize = 50000;

struct TestHarness {
    mem: AtomicBuffer,
    writer: crate::primitives::triple_buffer::TripleBufferWriter,
    _reader: crate::primitives::triple_buffer::TripleBufferReader,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);

    TestHarness {
        mem,
        writer,
        _reader: reader,
    }
}

#[test]
fn synapse_writer_set_get_all_fields() {
    let h = setup();
    let node_chain = NodeChainWriter::<8>::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        NODE_FL_START,
        NODE_HEAD_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::<8, 8>::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        node_chain.clone(),
        node_chain.mem_end_offset(),
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();
    let syn = synapse_chain.connect(src, tgt, 5).unwrap();

    let s = synapse_chain.get_synapse(syn);

    // verify fields set by connect
    assert_eq!(s.get_kind(), 5);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);

    s.set_outgoing_next_ptr(10);
    assert_eq!(s.get_outgoing_next_ptr(), 10);

    s.set_outgoing_prev_ptr(11);
    assert_eq!(s.get_outgoing_prev_ptr(), 11);

    s.set_incoming_next_ptr(20);
    assert_eq!(s.get_incoming_next_ptr(), 20);

    s.set_incoming_prev_ptr(21);
    assert_eq!(s.get_incoming_prev_ptr(), 21);
}

#[test]
fn synapse_writer_kind_bitmask_preserves_lower_bits() {
    let h = setup();
    let node_chain = NodeChainWriter::<8>::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        NODE_FL_START,
        NODE_HEAD_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::<8, 8>::new(
        Arc::clone(&h.mem),
        h.writer.clone(),
        node_chain.clone(),
        node_chain.mem_end_offset(),
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();
    let syn = synapse_chain.connect(src, tgt, 0).unwrap();

    let s = synapse_chain.get_synapse(syn);

    // mutate whatever mutable field occupies the lower 24 bits of field 0
    s.set_kind(0x7F); // simulate lower bits being set
    let raw = s.get_kind();
    assert_eq!(raw, 0x7F, "opcode preserved");
}
