use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_store_config::NodeStoreConfig;
use synaptic_kernel::topology::node::node_store_reader::NodeStoreReader;
use synaptic_kernel::topology::node::node_store_writer::NodeStoreWriter;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;

fn create_mem(size: usize) -> AtomicBuffer {
    (0..size).map(|_| AtomicI32::new(0)).collect()
}

// Node TB: layout word at NODE_START_OFFSET, then interleaved core+meta per slot.
const MEM_SIZE: usize = 16384;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 4096;
const FL_START: usize = 13000;
const CAPACITY: usize = 16;
const NODE_START_OFFSET: usize = 0;

struct TestHarness {
    _mem: AtomicBuffer,
    writer: synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter,
    reader: synaptic_kernel::primitives::triple_buffer_reader::TripleBufferReader,
    chain: NodeStoreWriter,
    chain_r: NodeStoreReader,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    let reader = writer.to_reader();
    let chain = NodeStoreWriter::new(
        Arc::clone(&mem),
        writer.clone(),
        NodeStoreConfig {
            meta_stride: NODE_META,
            attr_stride: NODE_ATTR,
            capacity: CAPACITY,
        },
        FL_START,
        NODE_START_OFFSET,
    );
    let chain_r = chain.to_reader();

    TestHarness {
        _mem: mem,
        writer,
        reader,
        chain,
        chain_r,
    }
}

fn insert_node_with_tick(chain: &NodeStoreWriter, kind: i32, tick: i32) -> usize {
    let slot = chain.insert_node(kind).unwrap();
    chain.get_node(slot).set_meta(0, tick);
    slot
}

#[test]
fn insert_node_creates_orphan_with_prev_and_next_zero() {
    let h = setup();
    let chain = h.chain;

    assert_eq!(chain.len(), 0);

    let slot = chain.insert_node(1).unwrap();
    let n = chain.get_node(slot);

    assert_eq!(n.get_kind(), 1);
    assert_eq!(n.get_next_ptr(), 0);
    assert_eq!(n.get_prev_ptr(), 0);
    assert_eq!(slot, 1, "first alloc = slot 1");
}

#[test]
fn two_insert_node_calls_produce_disjoint_orphans() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node(2).unwrap();

    assert_eq!(chain.get_node(a).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);
    assert_eq!(chain.get_node(b).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);
}

#[test]
fn extending_one_subchain_does_not_affect_other() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node(2).unwrap();
    let c = chain.insert_node_after(a, 3).unwrap();

    assert_eq!(chain.get_node(a).get_next_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);
}

// ============ NodeStoreWriter: insert ============

#[test]
fn insert_after_tail() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_after(a, 2).unwrap();

    // chain: a -> b
    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), 0, "b is tail");
}

#[test]
fn insert_after_middle() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let c = chain.insert_node_after(a, 3).unwrap();
    // chain: a -> c
    let b = chain.insert_node_after(a, 2).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), b);
    assert_eq!(chain.get_node(c).get_next_ptr(), 0);
}

// ============ NodeStoreWriter: insert_before ============

#[test]
fn insert_before_first_node_makes_new_subchain_head() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();

    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), 0);
}

#[test]
fn insert_before_middle_node() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let c = chain.insert_node_after(a, 3).unwrap();
    // chain: a -> c
    let b = chain.insert_node_before(c, 2).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), b);
}

#[test]
fn build_chain_of_three_via_insert_before() {
    let h = setup();
    let chain = h.chain;

    let a = insert_node_with_tick(&chain, 1, 10);
    let b = chain.insert_node_before(a, 2).unwrap();
    chain.get_node(b).set_meta(0, 20);
    let c = chain.insert_node_before(b, 3).unwrap();
    chain.get_node(c).set_meta(0, 30);

    // chain: c -> b -> a
    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);

    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);

    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);
}

// ============ NodeStoreWriter: remove ============

#[test]
fn remove_only_node_empties_store() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    chain.remove_node(a).unwrap();

    assert_eq!(chain.len(), 0);
}

#[test]
fn remove_subchain_head_promotes_next() {
    let h = setup();
    let chain = h.chain;

    let tail = chain.insert_node(1).unwrap();
    let head = chain.insert_node_before(tail, 2).unwrap();
    // chain: head(kind 2) -> tail(kind 1)

    chain.remove_node(head).unwrap();

    let n = chain.get_node(tail);
    assert_eq!(n.get_kind(), 1);
    assert_eq!(n.get_prev_ptr(), 0);
    assert_eq!(n.get_next_ptr(), 0);
}

#[test]
fn remove_tail_patches_prev() {
    let h = setup();
    let chain = h.chain;

    let head = chain.insert_node(1).unwrap();
    let tail = chain.insert_node_after(head, 2).unwrap();
    // chain: head -> tail

    chain.remove_node(tail).unwrap();

    let node_head = chain.get_node(head);
    assert_eq!(node_head.get_next_ptr(), 0, "head is now tail");
    assert_eq!(node_head.get_prev_ptr(), 0);
}

#[test]
fn remove_middle_heals_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    let c = chain.insert_node_before(b, 3).unwrap();
    // chain: c -> b -> a

    chain.remove_node(b).unwrap();
    // chain: c -> a

    assert_eq!(chain.get_node(c).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), c);
}

#[test]
fn remove_all_then_reinsert() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node(2).unwrap();
    let c = chain.insert_node(3).unwrap();

    chain.remove_node(c).unwrap();
    chain.remove_node(b).unwrap();
    chain.remove_node(a).unwrap();

    assert_eq!(chain.len(), 0);

    let d = chain.insert_node(99).unwrap();
    let n = chain.get_node(d);
    assert_eq!(n.get_kind(), 99);
    assert_eq!(n.get_next_ptr(), 0);
    assert_eq!(n.get_prev_ptr(), 0);
}

#[test]
fn double_remove_returns_error() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    chain.remove_node(a).unwrap();
}

// ============ NodeStoreReader: traversal after publish ============

#[test]
fn chain_reader_traverses_full_chain() {
    let h = setup();

    let head_slot = {
        let chain = h.chain;

        let a = insert_node_with_tick(&chain, 1, 10);
        let b = chain.insert_node_before(a, 2).unwrap();
        chain.get_node(b).set_meta(0, 20);
        let c = chain.insert_node_before(b, 3).unwrap();
        chain.get_node(c).set_meta(0, 30);
        c
    };
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    // chain: c -> b -> a
    let head = chain_r.get_node(head_slot);
    assert_eq!(head.get_kind(), 3);
    assert_eq!(head.get_meta(0), 30);

    let node_b = chain_r.get_node(head.get_next_ptr());
    assert_eq!(node_b.get_kind(), 2);

    let node_a = chain_r.get_node(node_b.get_next_ptr());
    assert_eq!(node_a.get_kind(), 1);
    assert_eq!(node_a.get_next_ptr(), 0, "end of chain");
}

#[test]
fn chain_reader_sees_empty_store_after_publish() {
    let h = setup();
    assert_eq!(h.chain.len(), 0);
    h.writer.publish();
    h.reader.swap();

    assert_eq!(h.chain.len(), 0);
}

#[test]
fn chain_reader_sees_removal_after_publish() {
    let h = setup();

    let entry_slot = {
        let chain = h.chain;

        let a = chain.insert_node(1).unwrap();
        let b = chain.insert_node_before(a, 2).unwrap();
        // chain: b -> a
        chain.remove_node(b).unwrap();
        // chain: a
        a
    };
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    let head = chain_r.get_node(entry_slot);
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0, "only one node left");
}

// ============ Capacity exhaustion ============

#[test]
fn insert_orphan_exhausts_capacity() {
    let h = setup();
    let chain = h.chain;

    for i in 0..CAPACITY {
        assert!(chain.insert_node(i as i32).is_some());
    }
    assert!(chain.insert_node(99).is_none(), "capacity exhausted");
}

// ============ Pointer stability across operations ============

#[test]
fn insert_after_does_not_mutate_unrelated_nodes() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_after(a, 2).unwrap();
    let c = chain.insert_node_after(b, 3).unwrap();
    // chain: a -> b -> c

    // Insert d after a (between a and b)
    let d = chain.insert_node_after(a, 4).unwrap();
    // chain: a -> d -> b -> c

    // c must not be touched
    assert_eq!(chain.get_node(c).get_prev_ptr(), b, "c's prev unchanged");
    assert_eq!(chain.get_node(c).get_next_ptr(), 0, "c's next unchanged");

    // b's prev updated to d
    assert_eq!(chain.get_node(b).get_prev_ptr(), d);
    // b's next unchanged
    assert_eq!(chain.get_node(b).get_next_ptr(), c);
}

// ============ Forward + backward traversal ============

#[test]
fn four_node_store_traversal_forward_and_backward() {
    let h = setup();
    let chain = h.chain;

    let a = insert_node_with_tick(&chain, 1, 10);
    let b = chain.insert_node_before(a, 2).unwrap();
    chain.get_node(b).set_meta(0, 20);
    let c = chain.insert_node_before(b, 3).unwrap();
    chain.get_node(c).set_meta(0, 30);
    let d = chain.insert_node_before(c, 4).unwrap();
    chain.get_node(d).set_meta(0, 40);

    // forward: d -> c -> b -> a -> 0
    let h0 = chain.get_node(d);
    assert_eq!(h0.get_kind(), 4);
    let n1 = chain.get_node(h0.get_next_ptr());
    assert_eq!(n1.get_kind(), 3);
    let n2 = chain.get_node(n1.get_next_ptr());
    assert_eq!(n2.get_kind(), 2);
    let n3 = chain.get_node(n2.get_next_ptr());
    assert_eq!(n3.get_kind(), 1);
    assert_eq!(n3.get_next_ptr(), 0, "end of chain");

    // backward: a -> b -> c -> d -> 0
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), d);
    assert_eq!(chain.get_node(d).get_prev_ptr(), 0, "start of sub-chain");
}

// ============ insert_after / insert_before exhaustion ============

#[test]
fn insert_after_returns_none_on_exhaustion() {
    let h = setup();
    let chain = h.chain;

    let head = chain.insert_node(0).unwrap();
    // fill remaining capacity via insert_after
    let mut last = head;
    for i in 1..CAPACITY {
        last = chain.insert_node_after(last, i as i32).unwrap();
    }
    assert!(
        chain.insert_node_after(last, 99).is_none(),
        "insert_after must return None when exhausted"
    );
}

#[test]
fn insert_before_returns_none_on_exhaustion() {
    let h = setup();
    let chain = h.chain;

    let head = chain.insert_node(0).unwrap();
    // fill remaining capacity via insert_before
    for i in 1..CAPACITY {
        chain.insert_node_before(head, i as i32).unwrap();
    }
    assert!(
        chain.insert_node_before(head, 99).is_none(),
        "insert_before must return None when exhausted"
    );
}

// ============ insert_before at tail ============

#[test]
fn insert_before_tail_in_three_node_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let c = chain.insert_node_after(a, 3).unwrap();
    let d = chain.insert_node_after(c, 4).unwrap();
    // chain: a -> c -> d

    // insert before tail (d)
    let e = chain.insert_node_before(d, 5).unwrap();
    // chain: a -> c -> e -> d

    assert_eq!(chain.get_node(c).get_next_ptr(), e);
    assert_eq!(chain.get_node(e).get_prev_ptr(), c);
    assert_eq!(chain.get_node(e).get_next_ptr(), d);
    assert_eq!(chain.get_node(d).get_prev_ptr(), e);
    assert_eq!(chain.get_node(d).get_next_ptr(), 0, "d is still tail");
}

// ============ Multi-order removal ============

#[test]
fn remove_tail_first_then_middle_then_head() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    let c = chain.insert_node_before(b, 3).unwrap();
    let d = chain.insert_node_before(c, 4).unwrap();
    // chain: d -> c -> b -> a

    // remove tail
    chain.remove_node(a).unwrap();
    // chain: d -> c -> b
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);

    // remove middle
    chain.remove_node(c).unwrap();
    // chain: d -> b
    assert_eq!(chain.get_node(d).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), d);

    // remove head
    chain.remove_node(d).unwrap();
    // chain: b
    let nb = chain.get_node(b);
    assert_eq!(nb.get_kind(), 2);
    assert_eq!(nb.get_prev_ptr(), 0);
    assert_eq!(nb.get_next_ptr(), 0);
}

#[test]
fn remove_arbitrary_order_on_five_node_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    let c = chain.insert_node_before(b, 3).unwrap();
    let d = chain.insert_node_before(c, 4).unwrap();
    let e = chain.insert_node_before(d, 5).unwrap();
    // chain: e -> d -> c -> b -> a

    // remove c (middle)
    chain.remove_node(c).unwrap();
    // chain: e -> d -> b -> a
    assert_eq!(chain.get_node(d).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), d);

    // remove e (head)
    chain.remove_node(e).unwrap();
    // chain: d -> b -> a
    assert_eq!(chain.get_node(d).get_kind(), 4);
    assert_eq!(chain.get_node(d).get_prev_ptr(), 0);

    // remove a (tail)
    chain.remove_node(a).unwrap();
    // chain: d -> b
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);

    // remove d (head again)
    chain.remove_node(d).unwrap();
    // chain: b
    let nb = chain.get_node(b);
    assert_eq!(nb.get_kind(), 2);
    assert_eq!(nb.get_prev_ptr(), 0);
    assert_eq!(nb.get_next_ptr(), 0);

    // remove last
    chain.remove_node(b).unwrap();
    assert_eq!(chain.len(), 0);
}

// ============ Remove then traverse via reader ============

#[test]
fn reader_traverses_chain_after_mid_chain_removal() {
    let h = setup();

    let head_slot = {
        let chain = h.chain;

        let a = insert_node_with_tick(&chain, 1, 10);
        let b = chain.insert_node_before(a, 2).unwrap();
        chain.get_node(b).set_meta(0, 20);
        let c = chain.insert_node_before(b, 3).unwrap();
        chain.get_node(c).set_meta(0, 30);
        let d = chain.insert_node_before(c, 4).unwrap();
        chain.get_node(d).set_meta(0, 40);
        // chain: d -> c -> b -> a

        chain.remove_node(b).unwrap();
        // chain: d -> c -> a
        d
    };
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    // forward traversal: d -> c -> a -> 0
    let head = chain_r.get_node(head_slot);
    assert_eq!(head.get_kind(), 4);
    assert_eq!(head.get_meta(0), 40);

    let n1 = chain_r.get_node(head.get_next_ptr());
    assert_eq!(n1.get_kind(), 3);

    let n2 = chain_r.get_node(n1.get_next_ptr());
    assert_eq!(n2.get_kind(), 1);
    assert_eq!(n2.get_next_ptr(), 0, "end of chain");
}

// ============ copy_from ============

#[test]
fn copy_from_preserves_topology_and_deep_data() {
    let src_h = setup();
    let src = src_h.chain;

    let a = insert_node_with_tick(&src, 1, 10);
    let b = insert_node_with_tick(&src, 2, 20);

    src.remove_node(b).unwrap(); // b deferred

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst = NodeStoreWriter::new(
        Arc::clone(&dst_mem),
        dst_tb,
        NodeStoreConfig {
            meta_stride: NODE_META,
            attr_stride: NODE_ATTR,
            capacity: CAPACITY * 2,
        },
        FL_START,
        NODE_START_OFFSET,
    );

    dst.copy_from(&src);

    assert_eq!(dst.len(), 2);
    let node_a = dst.get_node(a);
    assert_eq!(node_a.get_kind(), 1);
    assert_eq!(node_a.get_meta(0), 10);
    assert_eq!(node_a.get_next_ptr(), 0);

    dst.publish();

    // Simulate reader acknowledging the publish
    dst.to_reader().ack_generation();

    dst.publish();

    assert_eq!(dst.len(), 1);
    assert_eq!(dst.capacity(), CAPACITY * 2);
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = TripleBufferWriter::new(Arc::clone(&src_mem), TB_START, TB_BUF_CAP);
    let src = NodeStoreWriter::new(
        src_mem,
        src_tb,
        NodeStoreConfig {
            meta_stride: NODE_META,
            attr_stride: NODE_ATTR,
            capacity: CAPACITY * 2,
        },
        FL_START,
        NODE_START_OFFSET,
    );

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst = NodeStoreWriter::new(
        dst_mem,
        dst_tb,
        NodeStoreConfig {
            meta_stride: NODE_META,
            attr_stride: NODE_ATTR,
            capacity: CAPACITY,
        },
        FL_START,
        NODE_START_OFFSET,
    );

    dst.copy_from(&src);
}
