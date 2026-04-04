use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::constants::NODE_SLOT_SIZE;
use symphonyscript_kernel::primitives::deferred_frees_list::DeferredFreesList;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::structural_plane::node::node_chain_reader::NodeChainReader;
use symphonyscript_kernel::structural_plane::node::node_chain_writer::NodeChainWriter;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_reader::SynapseChainReader;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const SAB_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const NODE_CAPACITY: usize = 16;
const SYNAPSE_CAPACITY: usize = 32;
const NODE_START_OFFSET: usize = 0;
const NODE_HEAD_OFFSET: usize = NODE_CAPACITY * NODE_SLOT_SIZE; // 256
const SYNAPSE_START_OFFSET: usize = NODE_HEAD_OFFSET + 1; // 257
const NODE_FL_START: usize = 50000;
const SYNAPSE_FL_START: usize = 51000;

struct TestHarness {
    _sab: SAB,
    writer: symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader,
    node_chain: NodeChainWriter,
    synapse_chain: SynapseChainWriter,
}

fn setup() -> TestHarness {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let node_chain = NodeChainWriter::new(
        Arc::clone(&sab),
        writer.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::new(
        Arc::clone(&sab),
        writer.clone(),
        node_chain.clone(),
        SYNAPSE_FL_START,
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );
    TestHarness {
        _sab: sab,
        writer,
        reader,
        node_chain,
        synapse_chain,
    }
}

fn draft(opcode: i32) -> SynapseDraft {
    SynapseDraft { opcode }
}

fn node(opcode: i32) -> NodeDraft {
    NodeDraft {
        opcode,
        base_tick: 0,
    }
}

// ============ connect: single synapse ============

#[test]
fn connect_single_synapse_between_two_nodes() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt = node_chain.insert_head(node(2)).unwrap();

    let syn = synapse_chain.connect(src, tgt, draft(10)).unwrap();

    // synapse fields
    let s = synapse_chain.get(syn);
    assert_eq!(s.get_opcode(), 10);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
    assert_eq!(s.get_outgoing_next_ptr(), 0, "only synapse: no next");
    assert_eq!(s.get_outgoing_prev_ptr(), 0, "only synapse: no prev");
    assert_eq!(s.get_incoming_next_ptr(), 0);
    assert_eq!(s.get_incoming_prev_ptr(), 0);

    // source node should have this synapse as outgoing head AND tail
    let src_node = node_chain.get(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), syn);
    assert_eq!(src_node.get_outgoing_synapse_tail(), syn);

    // target node should have this synapse as incoming head AND tail
    let tgt_node = node_chain.get(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), syn);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), syn);
}

// ============ connect: multiple synapses from same source ============

#[test]
fn connect_two_synapses_from_same_source() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt1 = node_chain.insert_head(node(2)).unwrap();
    let tgt2 = node_chain.insert_head(node(3)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();

    // source's outgoing chain: s1 -> s2 (tail-append)
    let src_node = node_chain.get(src);
    assert_eq!(
        src_node.get_outgoing_synapse_head(),
        s1,
        "head is first connected"
    );
    assert_eq!(
        src_node.get_outgoing_synapse_tail(),
        s2,
        "tail is last connected"
    );

    // s1 outgoing links
    let syn1 = synapse_chain.get(s1);
    assert_eq!(syn1.get_outgoing_prev_ptr(), 0, "s1 is head");
    assert_eq!(syn1.get_outgoing_next_ptr(), s2);

    // s2 outgoing links
    let syn2 = synapse_chain.get(s2);
    assert_eq!(syn2.get_outgoing_prev_ptr(), s1);
    assert_eq!(syn2.get_outgoing_next_ptr(), 0, "s2 is tail");

    // each target sees its own synapse independently
    assert_eq!(node_chain.get(tgt1).get_incoming_synapse_head(), s1);
    assert_eq!(node_chain.get(tgt1).get_incoming_synapse_tail(), s1);
    assert_eq!(node_chain.get(tgt2).get_incoming_synapse_head(), s2);
    assert_eq!(node_chain.get(tgt2).get_incoming_synapse_tail(), s2);
}

// ============ connect: multiple synapses to same target ============

#[test]
fn connect_two_synapses_to_same_target() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let tgt = node_chain.insert_head(node(3)).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, draft(20)).unwrap();

    // target's incoming chain: s1 -> s2
    let tgt_node = node_chain.get(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s2);

    // s1 incoming links
    assert_eq!(synapse_chain.get(s1).get_incoming_prev_ptr(), 0);
    assert_eq!(synapse_chain.get(s1).get_incoming_next_ptr(), s2);

    // s2 incoming links
    assert_eq!(synapse_chain.get(s2).get_incoming_prev_ptr(), s1);
    assert_eq!(synapse_chain.get(s2).get_incoming_next_ptr(), 0);

    // each source sees its own synapse independently
    assert_eq!(node_chain.get(src1).get_outgoing_synapse_head(), s1);
    assert_eq!(node_chain.get(src2).get_outgoing_synapse_head(), s2);
}

// ============ disconnect: single synapse ============

#[test]
fn disconnect_only_synapse_clears_node_pointers() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt = node_chain.insert_head(node(2)).unwrap();
    let syn = synapse_chain.connect(src, tgt, draft(10)).unwrap();

    synapse_chain.disconnect(syn);

    // source's outgoing chain completely empty
    let src_node = node_chain.get(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), 0);
    assert_eq!(src_node.get_outgoing_synapse_tail(), 0);

    // target's incoming chain completely empty
    let tgt_node = node_chain.get(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), 0);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), 0);
}

// ============ disconnect: head of chain ============

#[test]
fn disconnect_head_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt1 = node_chain.insert_head(node(2)).unwrap();
    let tgt2 = node_chain.insert_head(node(3)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();
    // src outgoing: s1 -> s2

    synapse_chain.disconnect(s1);
    // src outgoing: s2

    let src_node = node_chain.get(src);
    assert_eq!(
        src_node.get_outgoing_synapse_head(),
        s2,
        "head promoted to s2"
    );
    assert_eq!(src_node.get_outgoing_synapse_tail(), s2, "tail unchanged");

    let syn2 = synapse_chain.get(s2);
    assert_eq!(syn2.get_outgoing_prev_ptr(), 0, "s2 is now head");
}

// ============ disconnect: tail of chain ============

#[test]
fn disconnect_tail_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt1 = node_chain.insert_head(node(2)).unwrap();
    let tgt2 = node_chain.insert_head(node(3)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();
    // src outgoing: s1 -> s2

    synapse_chain.disconnect(s2);
    // src outgoing: s1

    let src_node = node_chain.get(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);
    assert_eq!(
        src_node.get_outgoing_synapse_tail(),
        s1,
        "tail demoted to s1"
    );

    let syn1 = synapse_chain.get(s1);
    assert_eq!(syn1.get_outgoing_next_ptr(), 0, "s1 is now tail");
}

// ============ disconnect: middle of chain ============

#[test]
fn disconnect_middle_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt1 = node_chain.insert_head(node(2)).unwrap();
    let tgt2 = node_chain.insert_head(node(3)).unwrap();
    let tgt3 = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src, tgt3, draft(30)).unwrap();
    // src outgoing: s1 -> s2 -> s3

    synapse_chain.disconnect(s2);
    // src outgoing: s1 -> s3

    let src_node = node_chain.get(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);
    assert_eq!(src_node.get_outgoing_synapse_tail(), s3);

    assert_eq!(synapse_chain.get(s1).get_outgoing_next_ptr(), s3);
    assert_eq!(synapse_chain.get(s3).get_outgoing_prev_ptr(), s1);
}

// ============ disconnect: incoming chain healing ============

#[test]
fn disconnect_heals_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let src3 = node_chain.insert_head(node(3)).unwrap();
    let tgt = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, draft(30)).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect(s2);
    // tgt incoming: s1 -> s3

    let tgt_node = node_chain.get(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s3);

    assert_eq!(synapse_chain.get(s1).get_incoming_next_ptr(), s3);
    assert_eq!(synapse_chain.get(s3).get_incoming_prev_ptr(), s1);
}

// ============ dual-chain independence ============

#[test]
fn disconnect_heals_both_chains_independently() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    // Build: src -> tgt1, src -> tgt2 (outgoing from src: s1, s2)
    //        src2 -> tgt1 (incoming to tgt1: s1, s3)
    let src = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let tgt1 = node_chain.insert_head(node(3)).unwrap();
    let tgt2 = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src2, tgt1, draft(30)).unwrap();

    // src outgoing: s1 -> s2
    // tgt1 incoming: s1 -> s3

    // Disconnect s1: must heal BOTH src's outgoing chain AND tgt1's incoming chain
    synapse_chain.disconnect(s1);

    // src outgoing: s2 (head and tail)
    let src_node = node_chain.get(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s2);
    assert_eq!(src_node.get_outgoing_synapse_tail(), s2);
    assert_eq!(synapse_chain.get(s2).get_outgoing_prev_ptr(), 0);

    // tgt1 incoming: s3 (head and tail)
    let tgt1_node = node_chain.get(tgt1);
    assert_eq!(tgt1_node.get_incoming_synapse_head(), s3);
    assert_eq!(tgt1_node.get_incoming_synapse_tail(), s3);
    assert_eq!(synapse_chain.get(s3).get_incoming_prev_ptr(), 0);
}

// ============ double disconnect ============

#[test]
fn double_disconnect_returns_error() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt = node_chain.insert_head(node(2)).unwrap();
    let syn = synapse_chain.connect(src, tgt, draft(10)).unwrap();

    synapse_chain.disconnect(syn);
    /* commented err check */
}

// ============ connect + disconnect + reconnect cycle ============

#[test]
fn full_connect_disconnect_reconnect_cycle() {
    let h = setup();
    let node_chain = h.node_chain;
    let mut synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt = node_chain.insert_head(node(2)).unwrap();

    // connect
    let s1 = synapse_chain.connect(src, tgt, draft(10)).unwrap();
    assert_eq!(node_chain.get(src).get_outgoing_synapse_head(), s1);

    // disconnect
    synapse_chain.disconnect(s1);
    assert_eq!(node_chain.get(src).get_outgoing_synapse_head(), 0);
    assert_eq!(node_chain.get(tgt).get_incoming_synapse_head(), 0);

    synapse_chain.free_deferred_slots().unwrap();
    synapse_chain.free_deferred_slots().unwrap();

    // reconnect (slot should be reused)
    let s2 = synapse_chain.connect(src, tgt, draft(20)).unwrap();
    assert_eq!(s2, s1, "freed synapse slot should be reused");
    assert_eq!(node_chain.get(src).get_outgoing_synapse_head(), s2);
    assert_eq!(node_chain.get(tgt).get_incoming_synapse_head(), s2);
}

// ============ self-loop: source == target ============

#[test]
fn connect_self_loop() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let n = node_chain.insert_head(node(1)).unwrap();
    let syn = synapse_chain.connect(n, n, draft(99)).unwrap();

    let node_view = node_chain.get(n);
    assert_eq!(node_view.get_outgoing_synapse_head(), syn);
    assert_eq!(node_view.get_outgoing_synapse_tail(), syn);
    assert_eq!(node_view.get_incoming_synapse_head(), syn);
    assert_eq!(node_view.get_incoming_synapse_tail(), syn);

    let s = synapse_chain.get(syn);
    assert_eq!(s.get_source_ptr(), n);
    assert_eq!(s.get_target_ptr(), n);
}

#[test]
fn disconnect_self_loop_clears_both_chains() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let n = node_chain.insert_head(node(1)).unwrap();
    let syn = synapse_chain.connect(n, n, draft(99)).unwrap();
    synapse_chain.disconnect(syn);

    let node_view = node_chain.get(n);
    assert_eq!(node_view.get_outgoing_synapse_head(), 0);
    assert_eq!(node_view.get_outgoing_synapse_tail(), 0);
    assert_eq!(node_view.get_incoming_synapse_head(), 0);
    assert_eq!(node_view.get_incoming_synapse_tail(), 0);
}

// ============ reader: verify via publish/swap ============

#[test]
fn synapse_chain_reader_sees_connections_after_publish() {
    let mut h = setup();

    let (src, tgt, syn) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain.insert_head(node(1)).unwrap();
        let tgt = node_chain.insert_head(node(2)).unwrap();
        let syn = synapse_chain.connect(src, tgt, draft(42)).unwrap();
        (src, tgt, syn)
    };
    h.writer.publish();
    h.reader.swap();

    let node_chain_r = NodeChainReader::new(h.reader.clone(), NODE_START_OFFSET, NODE_CAPACITY);
    let synapse_chain_r =
        SynapseChainReader::new(h.reader.clone(), SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);

    let s = synapse_chain_r.get(syn);
    assert_eq!(s.get_opcode(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);

    // verify node reader sees the synapse pointers
    let src_r = node_chain_r.get(src);
    assert_eq!(src_r.get_outgoing_synapse_head(), syn);
    assert_eq!(src_r.get_outgoing_synapse_tail(), syn);
}

// ============ disconnect: incoming chain head ============

#[test]
fn disconnect_head_of_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let src3 = node_chain.insert_head(node(3)).unwrap();
    let tgt = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, draft(30)).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect(s1);
    // tgt incoming: s2 -> s3

    let tgt_node = node_chain.get(tgt);
    assert_eq!(
        tgt_node.get_incoming_synapse_head(),
        s2,
        "head promoted to s2"
    );
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s3, "tail unchanged");
    assert_eq!(
        synapse_chain.get(s2).get_incoming_prev_ptr(),
        0,
        "s2 is now head"
    );
    assert_eq!(synapse_chain.get(s2).get_incoming_next_ptr(), s3);
}

// ============ disconnect: incoming chain tail ============

#[test]
fn disconnect_tail_of_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let src3 = node_chain.insert_head(node(3)).unwrap();
    let tgt = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, draft(30)).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect(s3);
    // tgt incoming: s1 -> s2

    let tgt_node = node_chain.get(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1, "head unchanged");
    assert_eq!(
        tgt_node.get_incoming_synapse_tail(),
        s2,
        "tail demoted to s2"
    );
    assert_eq!(
        synapse_chain.get(s2).get_incoming_next_ptr(),
        0,
        "s2 is now tail"
    );
}

// ============ chain traversal ============

#[test]
fn outgoing_chain_traversal_order_is_insertion_order() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt1 = node_chain.insert_head(node(2)).unwrap();
    let tgt2 = node_chain.insert_head(node(3)).unwrap();
    let tgt3 = node_chain.insert_head(node(4)).unwrap();
    let tgt4 = node_chain.insert_head(node(5)).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src, tgt3, draft(30)).unwrap();
    let s4 = synapse_chain.connect(src, tgt4, draft(40)).unwrap();

    // walk forward: head -> next -> next -> next -> null
    let head = node_chain.get(src).get_outgoing_synapse_head();
    assert_eq!(head, s1);
    let n1 = synapse_chain.get(head).get_outgoing_next_ptr();
    assert_eq!(n1, s2);
    let n2 = synapse_chain.get(n1).get_outgoing_next_ptr();
    assert_eq!(n2, s3);
    let n3 = synapse_chain.get(n2).get_outgoing_next_ptr();
    assert_eq!(n3, s4);
    let n4 = synapse_chain.get(n3).get_outgoing_next_ptr();
    assert_eq!(n4, 0, "end of chain");

    // walk backward: tail -> prev -> prev -> prev -> null
    let tail = node_chain.get(src).get_outgoing_synapse_tail();
    assert_eq!(tail, s4);
    let p1 = synapse_chain.get(tail).get_outgoing_prev_ptr();
    assert_eq!(p1, s3);
    let p2 = synapse_chain.get(p1).get_outgoing_prev_ptr();
    assert_eq!(p2, s2);
    let p3 = synapse_chain.get(p2).get_outgoing_prev_ptr();
    assert_eq!(p3, s1);
    let p4 = synapse_chain.get(p3).get_outgoing_prev_ptr();
    assert_eq!(p4, 0, "start of chain");
}

#[test]
fn incoming_chain_traversal_order_is_insertion_order() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(node(1)).unwrap();
    let src2 = node_chain.insert_head(node(2)).unwrap();
    let src3 = node_chain.insert_head(node(3)).unwrap();
    let tgt = node_chain.insert_head(node(4)).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, draft(10)).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, draft(20)).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, draft(30)).unwrap();

    // walk forward: head -> next -> next -> null
    let head = node_chain.get(tgt).get_incoming_synapse_head();
    assert_eq!(head, s1);
    assert_eq!(synapse_chain.get(s1).get_incoming_next_ptr(), s2);
    assert_eq!(synapse_chain.get(s2).get_incoming_next_ptr(), s3);
    assert_eq!(synapse_chain.get(s3).get_incoming_next_ptr(), 0);

    // walk backward
    let tail = node_chain.get(tgt).get_incoming_synapse_tail();
    assert_eq!(tail, s3);
    assert_eq!(synapse_chain.get(s3).get_incoming_prev_ptr(), s2);
    assert_eq!(synapse_chain.get(s2).get_incoming_prev_ptr(), s1);
    assert_eq!(synapse_chain.get(s1).get_incoming_prev_ptr(), 0);
}

// ============ fan-in + fan-out isolation ============

#[test]
fn disconnect_outgoing_does_not_affect_incoming() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    // node B has both outgoing (B->C) and incoming (A->B)
    let a = node_chain.insert_head(node(1)).unwrap();
    let b = node_chain.insert_head(node(2)).unwrap();
    let c = node_chain.insert_head(node(3)).unwrap();

    let s_ab = synapse_chain.connect(a, b, draft(10)).unwrap(); // A->B
    let s_bc = synapse_chain.connect(b, c, draft(20)).unwrap(); // B->C

    // disconnect B's outgoing (B->C)
    synapse_chain.disconnect(s_bc);

    // B's outgoing should be empty
    let b_node = node_chain.get(b);
    assert_eq!(b_node.get_outgoing_synapse_head(), 0);
    assert_eq!(b_node.get_outgoing_synapse_tail(), 0);

    // B's incoming (A->B) must be completely untouched
    assert_eq!(b_node.get_incoming_synapse_head(), s_ab);
    assert_eq!(b_node.get_incoming_synapse_tail(), s_ab);

    // A's outgoing must also be untouched
    assert_eq!(node_chain.get(a).get_outgoing_synapse_head(), s_ab);
}

#[test]
fn disconnect_incoming_does_not_affect_outgoing() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let a = node_chain.insert_head(node(1)).unwrap();
    let b = node_chain.insert_head(node(2)).unwrap();
    let c = node_chain.insert_head(node(3)).unwrap();

    let s_ab = synapse_chain.connect(a, b, draft(10)).unwrap(); // A->B
    let s_bc = synapse_chain.connect(b, c, draft(20)).unwrap(); // B->C

    // disconnect B's incoming (A->B)
    synapse_chain.disconnect(s_ab);

    // B's incoming should be empty
    let b_node = node_chain.get(b);
    assert_eq!(b_node.get_incoming_synapse_head(), 0);
    assert_eq!(b_node.get_incoming_synapse_tail(), 0);

    // B's outgoing (B->C) must be completely untouched
    assert_eq!(b_node.get_outgoing_synapse_head(), s_bc);
    assert_eq!(b_node.get_outgoing_synapse_tail(), s_bc);
}

// ============ complex topology ============

#[test]
fn triangle_topology_disconnect_one_edge() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let a = node_chain.insert_head(node(1)).unwrap();
    let b = node_chain.insert_head(node(2)).unwrap();
    let c = node_chain.insert_head(node(3)).unwrap();

    let s_ab = synapse_chain.connect(a, b, draft(10)).unwrap(); // A->B
    let s_ac = synapse_chain.connect(a, c, draft(20)).unwrap(); // A->C
    let s_bc = synapse_chain.connect(b, c, draft(30)).unwrap(); // B->C

    // A outgoing: s_ab -> s_ac
    // C incoming: s_ac -> s_bc

    // disconnect A->B
    synapse_chain.disconnect(s_ab);

    // A outgoing: s_ac only
    assert_eq!(node_chain.get(a).get_outgoing_synapse_head(), s_ac);
    assert_eq!(node_chain.get(a).get_outgoing_synapse_tail(), s_ac);
    assert_eq!(synapse_chain.get(s_ac).get_outgoing_prev_ptr(), 0);
    assert_eq!(synapse_chain.get(s_ac).get_outgoing_next_ptr(), 0);

    // B incoming: empty (was only s_ab)
    assert_eq!(node_chain.get(b).get_incoming_synapse_head(), 0);
    assert_eq!(node_chain.get(b).get_incoming_synapse_tail(), 0);

    // B outgoing: s_bc still intact
    assert_eq!(node_chain.get(b).get_outgoing_synapse_head(), s_bc);

    // C incoming: s_ac -> s_bc still intact
    assert_eq!(node_chain.get(c).get_incoming_synapse_head(), s_ac);
    assert_eq!(node_chain.get(c).get_incoming_synapse_tail(), s_bc);
    assert_eq!(synapse_chain.get(s_ac).get_incoming_next_ptr(), s_bc);
    assert_eq!(synapse_chain.get(s_bc).get_incoming_prev_ptr(), s_ac);
}

// ============ capacity exhaustion ============

#[test]
fn connect_exhausts_synapse_capacity() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(node(1)).unwrap();
    let tgt = node_chain.insert_head(node(2)).unwrap();

    for i in 0..SYNAPSE_CAPACITY {
        assert!(
            synapse_chain.connect(src, tgt, draft(i as i32)).is_some(),
            "synapse {} should succeed",
            i
        );
    }
    assert!(
        synapse_chain.connect(src, tgt, draft(99)).is_none(),
        "capacity exhausted"
    );
}

// ============ disconnect all then verify node is clean ============

#[test]
fn disconnect_all_synapses_leaves_node_clean() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let a = node_chain.insert_head(node(1)).unwrap();
    let b = node_chain.insert_head(node(2)).unwrap();
    let c = node_chain.insert_head(node(3)).unwrap();

    // A has outgoing: s1, s2. A has incoming: s3.
    let s1 = synapse_chain.connect(a, b, draft(10)).unwrap();
    let s2 = synapse_chain.connect(a, c, draft(20)).unwrap();
    let s3 = synapse_chain.connect(c, a, draft(30)).unwrap();

    // disconnect all synapses touching A
    synapse_chain.disconnect(s1);
    synapse_chain.disconnect(s2);
    synapse_chain.disconnect(s3);

    // A must be completely clean
    let a_node = node_chain.get(a);
    assert_eq!(a_node.get_outgoing_synapse_head(), 0);
    assert_eq!(a_node.get_outgoing_synapse_tail(), 0);
    assert_eq!(a_node.get_incoming_synapse_head(), 0);
    assert_eq!(a_node.get_incoming_synapse_tail(), 0);
}

// ============ multiple self-loops ============

#[test]
fn two_self_loops_on_same_node() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let n = node_chain.insert_head(node(1)).unwrap();
    let s1 = synapse_chain.connect(n, n, draft(10)).unwrap();
    let s2 = synapse_chain.connect(n, n, draft(20)).unwrap();

    // both outgoing and incoming chains: s1 -> s2
    let nv = node_chain.get(n);
    assert_eq!(nv.get_outgoing_synapse_head(), s1);
    assert_eq!(nv.get_outgoing_synapse_tail(), s2);
    assert_eq!(nv.get_incoming_synapse_head(), s1);
    assert_eq!(nv.get_incoming_synapse_tail(), s2);

    // outgoing links
    assert_eq!(synapse_chain.get(s1).get_outgoing_next_ptr(), s2);
    assert_eq!(synapse_chain.get(s2).get_outgoing_prev_ptr(), s1);

    // incoming links
    assert_eq!(synapse_chain.get(s1).get_incoming_next_ptr(), s2);
    assert_eq!(synapse_chain.get(s2).get_incoming_prev_ptr(), s1);

    // disconnect first self-loop
    synapse_chain.disconnect(s1);

    let nv = node_chain.get(n);
    assert_eq!(nv.get_outgoing_synapse_head(), s2);
    assert_eq!(nv.get_outgoing_synapse_tail(), s2);
    assert_eq!(nv.get_incoming_synapse_head(), s2);
    assert_eq!(nv.get_incoming_synapse_tail(), s2);
    assert_eq!(synapse_chain.get(s2).get_outgoing_prev_ptr(), 0);
    assert_eq!(synapse_chain.get(s2).get_incoming_prev_ptr(), 0);
}
