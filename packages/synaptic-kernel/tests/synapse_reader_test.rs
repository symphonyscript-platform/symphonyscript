use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::constants::NODE_STRIDE;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;
use synaptic_kernel::topology::synapse::synapse_chain_reader::SynapseChainReader;
use synaptic_kernel::topology::synapse::synapse_chain_writer::SynapseChainWriter;

const NODE_META: usize = 8;
const SYNAPSE_META: usize = 8;

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
const NODE_START_OFFSET: usize = 0;
const SYNAPSE_START_OFFSET: usize = 1 + NODE_CAPACITY * (NODE_STRIDE + NODE_META);
const NODE_FL_START: usize = 50000;
const SYNAPSE_FL_START: usize = 51000;

struct TestHarness {
    _mem: AtomicBuffer,
    writer: synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter,
    reader: synaptic_kernel::primitives::triple_buffer_reader::TripleBufferReader,
    node_chain: NodeChainWriter<NODE_META>,
    synapse_chain: SynapseChainWriter<NODE_META, SYNAPSE_META>,
    synapse_chain_r: SynapseChainReader<NODE_META, SYNAPSE_META>,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    let reader = writer.to_reader();
    let node_chain = NodeChainWriter::<NODE_META>::new(
        Arc::clone(&mem),
        writer.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::<NODE_META, SYNAPSE_META>::new(
        Arc::clone(&mem),
        writer.clone(),
        node_chain.clone(),
        SYNAPSE_FL_START,
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );
    let synapse_chain_r = synapse_chain.to_reader();
    TestHarness {
        _mem: mem,
        writer,
        reader,
        node_chain,
        synapse_chain,
        synapse_chain_r,
    }
}

#[test]
fn reader_sees_all_synapse_fields_after_publish() {
    let h = setup();

    let (src, tgt, syn) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain.insert_head(1).unwrap();
        let tgt = node_chain.insert_head(2).unwrap();
        let syn = synapse_chain.connect(src, tgt, 42).unwrap();
        (src, tgt, syn)
    };
    h.writer.publish();
    h.reader.swap();

    let synapse_chain_r = h.synapse_chain_r;
    let s = synapse_chain_r.get_synapse(syn);
    assert_eq!(s.get_kind(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
    assert_eq!(s.get_outgoing_next_ptr(), 0);
    assert_eq!(s.get_outgoing_prev_ptr(), 0);
    assert_eq!(s.get_incoming_next_ptr(), 0);
    assert_eq!(s.get_incoming_prev_ptr(), 0);
}

#[test]
fn reader_sees_chain_pointers_with_multiple_synapses() {
    let h = setup();

    let (src, s1, s2, s3) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain.insert_head(1).unwrap();
        let tgt1 = node_chain.insert_head(2).unwrap();
        let tgt2 = node_chain.insert_head(3).unwrap();
        let tgt3 = node_chain.insert_head(4).unwrap();

        let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
        let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
        let s3 = synapse_chain.connect(src, tgt3, 30).unwrap();
        (src, s1, s2, s3)
    };
    h.writer.publish();
    h.reader.swap();

    let reader = h.synapse_chain_r;

    // verify outgoing chain traversal via reader: s1 -> s2 -> s3
    let r1 = reader.get_synapse(s1);
    assert_eq!(r1.get_kind(), 10);
    assert_eq!(r1.get_source_ptr(), src);
    assert_eq!(r1.get_outgoing_prev_ptr(), 0, "s1 is head");
    assert_eq!(r1.get_outgoing_next_ptr(), s2);

    let r2 = reader.get_synapse(s2);
    assert_eq!(r2.get_kind(), 20);
    assert_eq!(r2.get_outgoing_prev_ptr(), s1);
    assert_eq!(r2.get_outgoing_next_ptr(), s3);

    let r3 = reader.get_synapse(s3);
    assert_eq!(r3.get_kind(), 30);
    assert_eq!(r3.get_outgoing_prev_ptr(), s2);
    assert_eq!(r3.get_outgoing_next_ptr(), 0, "s3 is tail");
}

#[test]
fn reader_does_not_see_unpublished_changes() {
    let h = setup();

    // publish initial state with one synapse
    let (src, tgt, s1) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain.clone();

        let src = node_chain.insert_head(1).unwrap();
        let tgt = node_chain.insert_head(2).unwrap();
        let s1 = synapse_chain.connect(src, tgt, 10).unwrap();
        (src, tgt, s1)
    };
    h.writer.publish();
    h.reader.swap();

    // add second synapse but DON'T publish
    {
        let synapse_chain = h.synapse_chain.clone();
        synapse_chain.connect(src, tgt, 20).unwrap();
    }
    // no publish, no swap

    // reader still sees old snapshot
    let reader = h.synapse_chain_r;
    let r1 = reader.get_synapse(s1);
    assert_eq!(r1.get_kind(), 10);
    assert_eq!(
        r1.get_outgoing_next_ptr(),
        0,
        "reader still sees s1 as tail"
    );
}

#[test]
fn reader_sees_disconnect_after_publish() {
    let h = setup();

    let s2 = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain.insert_head(1).unwrap();
        let tgt1 = node_chain.insert_head(2).unwrap();
        let tgt2 = node_chain.insert_head(3).unwrap();

        let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
        let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
        // outgoing: s1 -> s2

        synapse_chain.disconnect_synapse(s1).unwrap();
        // outgoing: s2
        s2
    };
    h.writer.publish();
    h.reader.swap();

    let reader = h.synapse_chain_r;
    let r2 = reader.get_synapse(s2);
    assert_eq!(r2.get_kind(), 20);
    assert_eq!(
        r2.get_outgoing_prev_ptr(),
        0,
        "s2 is now head after disconnect"
    );
    assert_eq!(r2.get_outgoing_next_ptr(), 0, "s2 is also tail");
}
