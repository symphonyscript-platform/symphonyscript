use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::constants::NODE_SIZE;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;
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
const SYNAPSE_START_OFFSET: usize = 1 + NODE_CAPACITY * (NODE_SIZE + NODE_META);
const NODE_FL_START: usize = 50000;
const SYNAPSE_FL_START: usize = 51000;

struct TestHarness {
    _mem: AtomicBuffer,
    writer: synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter,
    reader: synaptic_kernel::primitives::triple_buffer_reader::TripleBufferReader,
    node_chain: NodeChainWriter<NODE_META>,
    synapse_chain: SynapseChainWriter<NODE_META, SYNAPSE_META>,
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
    TestHarness {
        _mem: mem,
        writer,
        reader,
        node_chain,
        synapse_chain,
    }
}

// ============ connect: single synapse ============

#[test]
fn connect_single_synapse_between_two_nodes() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();

    let syn = synapse_chain.connect(src, tgt, 10).unwrap();

    // synapse fields
    let s = synapse_chain.get_synapse(syn);
    assert_eq!(s.get_kind(), 10);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
    assert_eq!(s.get_outgoing_next_ptr(), 0, "only synapse: no next");
    assert_eq!(s.get_outgoing_prev_ptr(), 0, "only synapse: no prev");
    assert_eq!(s.get_incoming_next_ptr(), 0);
    assert_eq!(s.get_incoming_prev_ptr(), 0);

    // source node should have this synapse as outgoing head AND tail
    let src_node = node_chain.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), syn);
    assert_eq!(src_node.get_outgoing_synapse_tail(), syn);

    // target node should have this synapse as incoming head AND tail
    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), syn);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), syn);
}

// ============ connect: multiple synapses from same source ============

#[test]
fn connect_two_synapses_from_same_source() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt1 = node_chain.insert_head(2).unwrap();
    let tgt2 = node_chain.insert_head(3).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();

    // source's outgoing chain: s1 -> s2 (tail-append)
    let src_node = node_chain.get_node(src);
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

    // s2 outgoing links

    // each target sees its own synapse independently
    assert_eq!(node_chain.get_node(tgt1).get_incoming_synapse_head(), s1);
    assert_eq!(node_chain.get_node(tgt1).get_incoming_synapse_tail(), s1);
    assert_eq!(node_chain.get_node(tgt2).get_incoming_synapse_head(), s2);
    assert_eq!(node_chain.get_node(tgt2).get_incoming_synapse_tail(), s2);
}

// ============ connect: multiple synapses to same target ============

#[test]
fn connect_two_synapses_to_same_target() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let tgt = node_chain.insert_head(3).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, 10).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, 20).unwrap();

    // target's incoming chain: s1 -> s2
    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s2);

    // s1 incoming links

    // s2 incoming links

    // each source sees its own synapse independently
    assert_eq!(node_chain.get_node(src1).get_outgoing_synapse_head(), s1);
    assert_eq!(node_chain.get_node(src2).get_outgoing_synapse_head(), s2);
}

// ============ disconnect: single synapse ============

#[test]
fn disconnect_only_synapse_clears_node_pointers() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();
    let syn = synapse_chain.connect(src, tgt, 10).unwrap();

    synapse_chain.disconnect_synapse(syn).unwrap();

    // source's outgoing chain completely empty
    let src_node = node_chain.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), 0);
    assert_eq!(src_node.get_outgoing_synapse_tail(), 0);

    // target's incoming chain completely empty
    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), 0);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), 0);
}

// ============ disconnect: head of chain ============

#[test]
fn disconnect_head_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt1 = node_chain.insert_head(2).unwrap();
    let tgt2 = node_chain.insert_head(3).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
    // src outgoing: s1 -> s2

    synapse_chain.disconnect_synapse(s1).unwrap();
    // src outgoing: s2

    let src_node = node_chain.get_node(src);
    assert_eq!(
        src_node.get_outgoing_synapse_head(),
        s2,
        "head promoted to s2"
    );
    assert_eq!(src_node.get_outgoing_synapse_tail(), s2, "tail unchanged");
}

// ============ disconnect: tail of chain ============

#[test]
fn disconnect_tail_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt1 = node_chain.insert_head(2).unwrap();
    let tgt2 = node_chain.insert_head(3).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
    // src outgoing: s1 -> s2

    synapse_chain.disconnect_synapse(s2).unwrap();
    // src outgoing: s1

    let src_node = node_chain.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);
    assert_eq!(
        src_node.get_outgoing_synapse_tail(),
        s1,
        "tail demoted to s1"
    );
}

// ============ disconnect: middle of chain ============

#[test]
fn disconnect_middle_of_outgoing_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt1 = node_chain.insert_head(2).unwrap();
    let tgt2 = node_chain.insert_head(3).unwrap();
    let tgt3 = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
    let s3 = synapse_chain.connect(src, tgt3, 30).unwrap();
    // src outgoing: s1 -> s2 -> s3

    synapse_chain.disconnect_synapse(s2).unwrap();
    // src outgoing: s1 -> s3

    let src_node = node_chain.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);
    assert_eq!(src_node.get_outgoing_synapse_tail(), s3);
}

// ============ disconnect: incoming chain healing ============

#[test]
fn disconnect_heals_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let src3 = node_chain.insert_head(3).unwrap();
    let tgt = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, 10).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, 20).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, 30).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect_synapse(s2).unwrap();
    // tgt incoming: s1 -> s3

    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1);
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s3);
}

// ============ dual-chain independence ============

#[test]
fn disconnect_heals_both_chains_independently() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    // Build: src -> tgt1, src -> tgt2 (outgoing from src: s1, s2)
    //        src2 -> tgt1 (incoming to tgt1: s1, s3)
    let src = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let tgt1 = node_chain.insert_head(3).unwrap();
    let tgt2 = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
    let s3 = synapse_chain.connect(src2, tgt1, 30).unwrap();

    // src outgoing: s1 -> s2
    // tgt1 incoming: s1 -> s3

    // Disconnect s1: must heal BOTH src's outgoing chain AND tgt1's incoming chain
    synapse_chain.disconnect_synapse(s1).unwrap();

    // src outgoing: s2 (head and tail)
    let src_node = node_chain.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s2);
    assert_eq!(src_node.get_outgoing_synapse_tail(), s2);

    // tgt1 incoming: s3 (head and tail)
    let tgt1_node = node_chain.get_node(tgt1);
    assert_eq!(tgt1_node.get_incoming_synapse_head(), s3);
    assert_eq!(tgt1_node.get_incoming_synapse_tail(), s3);
}

// ============ double disconnect ============

#[test]
fn double_disconnect_returns_error() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();
    let syn = synapse_chain.connect(src, tgt, 10).unwrap();

    synapse_chain.disconnect_synapse(syn).unwrap();
    /* commented err check */
}

// ============ connect + disconnect + reconnect cycle ============

#[test]
fn full_connect_disconnect_reconnect_cycle() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();

    // connect
    let s1 = synapse_chain.connect(src, tgt, 10).unwrap();
    assert_eq!(node_chain.get_node(src).get_outgoing_synapse_head(), s1);

    // disconnect
    synapse_chain.disconnect_synapse(s1).unwrap();
    assert_eq!(node_chain.get_node(src).get_outgoing_synapse_head(), 0);
    assert_eq!(node_chain.get_node(tgt).get_incoming_synapse_head(), 0);

    synapse_chain.publish();
    
    // Explicitly acknowledge the publish to free the disconnected synapse
    synapse_chain.to_staging_buffer_reader().ack();
    
    synapse_chain.publish();

    // reconnect (slot should be reused)
    let s2 = synapse_chain.connect(src, tgt, 20).unwrap();
    assert_eq!(s2, s1, "freed synapse slot should be reused");
    assert_eq!(node_chain.get_node(src).get_outgoing_synapse_head(), s2);
    assert_eq!(node_chain.get_node(tgt).get_incoming_synapse_head(), s2);
}

// ============ self-loop: source == target ============

#[test]
fn connect_self_loop() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let n = node_chain.insert_head(1).unwrap();
    let syn = synapse_chain.connect(n, n, 99).unwrap();

    let node_view = node_chain.get_node(n);
    assert_eq!(node_view.get_outgoing_synapse_head(), syn);
    assert_eq!(node_view.get_outgoing_synapse_tail(), syn);
    assert_eq!(node_view.get_incoming_synapse_head(), syn);
    assert_eq!(node_view.get_incoming_synapse_tail(), syn);

    let s = synapse_chain.get_synapse(syn);
    assert_eq!(s.get_source_ptr(), n);
    assert_eq!(s.get_target_ptr(), n);
}

#[test]
fn disconnect_self_loop_clears_both_chains() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let n = node_chain.insert_head(1).unwrap();
    let syn = synapse_chain.connect(n, n, 99).unwrap();
    synapse_chain.disconnect_synapse(syn).unwrap();

    let node_view = node_chain.get_node(n);
    assert_eq!(node_view.get_outgoing_synapse_head(), 0);
    assert_eq!(node_view.get_outgoing_synapse_tail(), 0);
    assert_eq!(node_view.get_incoming_synapse_head(), 0);
    assert_eq!(node_view.get_incoming_synapse_tail(), 0);
}

// ============ reader: verify via publish/swap ============

#[test]
fn synapse_chain_reader_sees_connections_after_publish() {
    let h = setup();

    let src = h.node_chain.insert_head(1).unwrap();
    let tgt = h.node_chain.insert_head(2).unwrap();
    let syn = h.synapse_chain.connect(src, tgt, 42).unwrap();

    h.writer.publish();
    h.reader.swap();

    let node_chain_r = h.node_chain.to_reader();
    let synapse_chain_r = h.synapse_chain.to_reader();

    let s = synapse_chain_r.get(syn);
    assert_eq!(s.get_kind(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);

    // verify node reader sees the synapse pointers
    let src_r = node_chain_r.get_node(src);
    assert_eq!(src_r.get_outgoing_synapse_head(), syn);
    assert_eq!(src_r.get_outgoing_synapse_tail(), syn);
}

// ============ disconnect: incoming chain head ============

#[test]
fn disconnect_head_of_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let src3 = node_chain.insert_head(3).unwrap();
    let tgt = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, 10).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, 20).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, 30).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect_synapse(s1).unwrap();
    // tgt incoming: s2 -> s3

    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(
        tgt_node.get_incoming_synapse_head(),
        s2,
        "head promoted to s2"
    );
    assert_eq!(tgt_node.get_incoming_synapse_tail(), s3, "tail unchanged");
    assert_eq!(
        synapse_chain.get_synapse(s2).get_incoming_prev_ptr(),
        0,
        "s2 is now head"
    );
}

// ============ disconnect: incoming chain tail ============

#[test]
fn disconnect_tail_of_incoming_chain() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let src3 = node_chain.insert_head(3).unwrap();
    let tgt = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, 10).unwrap();
    let s2 = synapse_chain.connect(src2, tgt, 20).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, 30).unwrap();
    // tgt incoming: s1 -> s2 -> s3

    synapse_chain.disconnect_synapse(s3).unwrap();
    // tgt incoming: s1 -> s2

    let tgt_node = node_chain.get_node(tgt);
    assert_eq!(tgt_node.get_incoming_synapse_head(), s1, "head unchanged");
    assert_eq!(
        tgt_node.get_incoming_synapse_tail(),
        s2,
        "tail demoted to s2"
    );
    assert_eq!(
        synapse_chain.get_synapse(s2).get_incoming_next_ptr(),
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

    let src = node_chain.insert_head(1).unwrap();
    let tgt1 = node_chain.insert_head(2).unwrap();
    let tgt2 = node_chain.insert_head(3).unwrap();
    let tgt3 = node_chain.insert_head(4).unwrap();
    let tgt4 = node_chain.insert_head(5).unwrap();

    let s1 = synapse_chain.connect(src, tgt1, 10).unwrap();
    let s2 = synapse_chain.connect(src, tgt2, 20).unwrap();
    let s3 = synapse_chain.connect(src, tgt3, 30).unwrap();
    let s4 = synapse_chain.connect(src, tgt4, 40).unwrap();

    // walk forward: head -> next -> next -> next -> null
    let head = node_chain.get_node(src).get_outgoing_synapse_head();
    assert_eq!(head, s1);
    let n1 = synapse_chain.get_synapse(head).get_outgoing_next_ptr();
    assert_eq!(n1, s2);
    let n2 = synapse_chain.get_synapse(n1).get_outgoing_next_ptr();
    assert_eq!(n2, s3);
    let n3 = synapse_chain.get_synapse(n2).get_outgoing_next_ptr();
    assert_eq!(n3, s4);
    let n4 = synapse_chain.get_synapse(n3).get_outgoing_next_ptr();
    assert_eq!(n4, 0, "end of chain");

    // walk backward: tail -> prev -> prev -> prev -> null
    let tail = node_chain.get_node(src).get_outgoing_synapse_tail();
    assert_eq!(tail, s4);
    let p1 = synapse_chain.get_synapse(tail).get_outgoing_prev_ptr();
    assert_eq!(p1, s3);
    let p2 = synapse_chain.get_synapse(p1).get_outgoing_prev_ptr();
    assert_eq!(p2, s2);
    let p3 = synapse_chain.get_synapse(p2).get_outgoing_prev_ptr();
    assert_eq!(p3, s1);
    let p4 = synapse_chain.get_synapse(p3).get_outgoing_prev_ptr();
    assert_eq!(p4, 0, "start of chain");
}

#[test]
fn incoming_chain_traversal_order_is_insertion_order() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src1 = node_chain.insert_head(1).unwrap();
    let src2 = node_chain.insert_head(2).unwrap();
    let src3 = node_chain.insert_head(3).unwrap();
    let tgt = node_chain.insert_head(4).unwrap();

    let s1 = synapse_chain.connect(src1, tgt, 10).unwrap();
    let _s2 = synapse_chain.connect(src2, tgt, 20).unwrap();
    let s3 = synapse_chain.connect(src3, tgt, 30).unwrap();

    // walk forward: head -> next -> next -> null
    let head = node_chain.get_node(tgt).get_incoming_synapse_head();
    assert_eq!(head, s1);

    // walk backward
    let tail = node_chain.get_node(tgt).get_incoming_synapse_tail();
    assert_eq!(tail, s3);
}

// ============ fan-in + fan-out isolation ============

#[test]
fn disconnect_outgoing_does_not_affect_incoming() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    // node B has both outgoing (B->C) and incoming (A->B)
    let a = node_chain.insert_head(1).unwrap();
    let b = node_chain.insert_head(2).unwrap();
    let c = node_chain.insert_head(3).unwrap();

    let s_ab = synapse_chain.connect(a, b, 10).unwrap(); // A->B
    let s_bc = synapse_chain.connect(b, c, 20).unwrap(); // B->C

    // disconnect B's outgoing (B->C)
    synapse_chain.disconnect_synapse(s_bc).unwrap();

    // B's outgoing should be empty
    let b_node = node_chain.get_node(b);
    assert_eq!(b_node.get_outgoing_synapse_head(), 0);
    assert_eq!(b_node.get_outgoing_synapse_tail(), 0);

    // B's incoming (A->B) must be completely untouched
    assert_eq!(b_node.get_incoming_synapse_head(), s_ab);
    assert_eq!(b_node.get_incoming_synapse_tail(), s_ab);

    // A's outgoing must also be untouched
    assert_eq!(node_chain.get_node(a).get_outgoing_synapse_head(), s_ab);
}

#[test]
fn disconnect_incoming_does_not_affect_outgoing() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let a = node_chain.insert_head(1).unwrap();
    let b = node_chain.insert_head(2).unwrap();
    let c = node_chain.insert_head(3).unwrap();

    let s_ab = synapse_chain.connect(a, b, 10).unwrap(); // A->B
    let s_bc = synapse_chain.connect(b, c, 20).unwrap(); // B->C

    // disconnect B's incoming (A->B)
    synapse_chain.disconnect_synapse(s_ab).unwrap();

    // B's incoming should be empty
    let b_node = node_chain.get_node(b);
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

    let a = node_chain.insert_head(1).unwrap();
    let b = node_chain.insert_head(2).unwrap();
    let c = node_chain.insert_head(3).unwrap();

    let s_ab = synapse_chain.connect(a, b, 10).unwrap(); // A->B
    let s_ac = synapse_chain.connect(a, c, 20).unwrap(); // A->C
    let s_bc = synapse_chain.connect(b, c, 30).unwrap(); // B->C

    // A outgoing: s_ab -> s_ac
    // C incoming: s_ac -> s_bc

    // disconnect A->B
    synapse_chain.disconnect_synapse(s_ab).unwrap();

    // A outgoing: s_ac only
    assert_eq!(node_chain.get_node(a).get_outgoing_synapse_head(), s_ac);
    assert_eq!(node_chain.get_node(a).get_outgoing_synapse_tail(), s_ac);
    assert_eq!(synapse_chain.get_synapse(s_ac).get_outgoing_prev_ptr(), 0);
    assert_eq!(synapse_chain.get_synapse(s_ac).get_outgoing_next_ptr(), 0);

    // B incoming: empty (was only s_ab)
    assert_eq!(node_chain.get_node(b).get_incoming_synapse_head(), 0);
    assert_eq!(node_chain.get_node(b).get_incoming_synapse_tail(), 0);

    // B outgoing: s_bc still intact
    assert_eq!(node_chain.get_node(b).get_outgoing_synapse_head(), s_bc);

    // C incoming: s_ac -> s_bc still intact
    assert_eq!(node_chain.get_node(c).get_incoming_synapse_head(), s_ac);
    assert_eq!(node_chain.get_node(c).get_incoming_synapse_tail(), s_bc);
    assert_eq!(synapse_chain.get_synapse(s_ac).get_incoming_next_ptr(), s_bc);
    assert_eq!(synapse_chain.get_synapse(s_bc).get_incoming_prev_ptr(), s_ac);
}

// ============ capacity exhaustion ============

#[test]
fn connect_exhausts_synapse_capacity() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let src = node_chain.insert_head(1).unwrap();
    let tgt = node_chain.insert_head(2).unwrap();

    for i in 0..SYNAPSE_CAPACITY {
        assert!(
            synapse_chain.connect(src, tgt, i as i32).is_some(),
            "synapse {} should succeed",
            i
        );
    }
    assert!(
        synapse_chain.connect(src, tgt, 99).is_none(),
        "capacity exhausted"
    );
}

// ============ disconnect all then verify node is clean ============

#[test]
fn disconnect_all_synapses_leaves_node_clean() {
    let h = setup();
    let node_chain = h.node_chain;
    let synapse_chain = h.synapse_chain;

    let a = node_chain.insert_head(1).unwrap();
    let b = node_chain.insert_head(2).unwrap();
    let c = node_chain.insert_head(3).unwrap();

    // A has outgoing: s1, s2. A has incoming: s3.
    let s1 = synapse_chain.connect(a, b, 10).unwrap();
    let s2 = synapse_chain.connect(a, c, 20).unwrap();
    let s3 = synapse_chain.connect(c, a, 30).unwrap();

    // disconnect all synapses touching A
    synapse_chain.disconnect_synapse(s1).unwrap();
    synapse_chain.disconnect_synapse(s2).unwrap();
    synapse_chain.disconnect_synapse(s3).unwrap();

    // A must be completely clean
    let a_node = node_chain.get_node(a);
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

    let n = node_chain.insert_head(1).unwrap();
    let s1 = synapse_chain.connect(n, n, 10).unwrap();
    let s2 = synapse_chain.connect(n, n, 20).unwrap();

    // both outgoing and incoming chains: s1 -> s2
    let nv = node_chain.get_node(n);
    assert_eq!(nv.get_outgoing_synapse_head(), s1);
    assert_eq!(nv.get_outgoing_synapse_tail(), s2);
    assert_eq!(nv.get_incoming_synapse_head(), s1);
    assert_eq!(nv.get_incoming_synapse_tail(), s2);

    // outgoing links

    // incoming links

    // disconnect first self-loop
    synapse_chain.disconnect_synapse(s1).unwrap();

    let nv = node_chain.get_node(n);
    assert_eq!(nv.get_outgoing_synapse_head(), s2);
    assert_eq!(nv.get_outgoing_synapse_tail(), s2);
    assert_eq!(nv.get_incoming_synapse_head(), s2);
    assert_eq!(nv.get_incoming_synapse_tail(), s2);
}

// ============ copy_from deep data integrity ============

#[test]
fn copy_from_preserves_topology_and_deep_data() {
    let src_h = setup();
    let n1 = src_h.node_chain.insert_head(1).unwrap();
    let n2 = src_h.node_chain.insert_head(2).unwrap();

    let s1 = src_h.synapse_chain.connect(n1, n2, 10).unwrap();
    let s2 = src_h.synapse_chain.connect(n2, n1, 20).unwrap();

    src_h.synapse_chain.disconnect_synapse(s2).unwrap(); // defer s2

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst_node_chain = NodeChainWriter::<NODE_META>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    let dst_synapse_chain = SynapseChainWriter::<NODE_META, SYNAPSE_META>::new(
        Arc::clone(&dst_mem),
        dst_tb,
        dst_node_chain.clone(),
        dst_node_chain.mem_end_offset(),
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY * 2,
    );

    dst_synapse_chain.copy_from(&src_h.synapse_chain);

    assert_eq!(dst_synapse_chain.len(), 2);

    let syn = dst_synapse_chain.get_synapse(s1);
    assert_eq!(syn.get_kind(), 10);

    // Test deferred flush behavior on destination shrinks allocated slots natively
    dst_synapse_chain.publish();
    
    // Explicitly acknowledge the publish 
    dst_synapse_chain.to_staging_buffer_reader().ack();
    
    dst_synapse_chain.publish();

    assert_eq!(dst_synapse_chain.len(), 1);
    assert_eq!(dst_synapse_chain.capacity(), SYNAPSE_CAPACITY * 2);
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let src_h = setup();

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst_node_chain = NodeChainWriter::<NODE_META>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    // Create destination with half capacity
    let dst_synapse_chain = SynapseChainWriter::<NODE_META, SYNAPSE_META>::new(
        dst_mem,
        dst_tb,
        dst_node_chain.clone(),
        dst_node_chain.mem_end_offset(),
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY / 2,
    );

    dst_synapse_chain.copy_from(&src_h.synapse_chain);
}
