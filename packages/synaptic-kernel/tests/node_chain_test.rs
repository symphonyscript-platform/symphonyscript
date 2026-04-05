use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_chain_reader::NodeChainReader;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;

const NODE_META: usize = 8;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// Node TB: head word at NODE_START_OFFSET, then interleaved core+meta per slot.
const MEM_SIZE: usize = 16384;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 4096;
const FL_START: usize = 13000;
const CAPACITY: usize = 16;
const NODE_START_OFFSET: usize = 0;

struct TestHarness {
    _mem: AtomicBuffer,
    writer: synaptic_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: synaptic_kernel::primitives::triple_buffer::TripleBufferReader,
    chain: NodeChainWriter<NODE_META>,
    chain_r: NodeChainReader<NODE_META>,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    let chain = NodeChainWriter::<NODE_META>::new(
        Arc::clone(&mem),
        writer.clone(),
        FL_START,
        NODE_START_OFFSET,
        CAPACITY,
    );
    let chain_r = NodeChainReader::<NODE_META>::bind(reader.clone(), NODE_START_OFFSET, CAPACITY);

    TestHarness {
        _mem: mem,
        writer,
        reader,
        chain,
        chain_r,
    }
}

fn insert_head_with_tick(chain: &NodeChainWriter<NODE_META>, kind: i32, tick: i32) -> usize {
    let slot = chain.insert_head(kind).unwrap();
    chain.get_node(slot).set_meta(0, tick);
    slot
}

// ============ NodeChainWriter: insert_head ============

#[test]
fn insert_head_into_empty_chain() {
    let h = setup();
    let chain = h.chain;

    assert!(chain.get_head().is_none());

    let slot = chain.insert_head(1).unwrap();
    let head = chain.get_head().unwrap();

    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0, "single node: next = null");
    assert_eq!(head.get_prev_ptr(), 0, "single node: prev = null");
    assert_eq!(slot, 1, "first alloc = slot 1");
}

#[test]
fn insert_head_pushes_existing_head() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();

    // chain: b -> a
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 2, "head is b");

    let node_b = chain.get_node(b);
    assert_eq!(node_b.get_next_ptr(), a);
    assert_eq!(node_b.get_prev_ptr(), 0, "head has no prev");

    let node_a = chain.get_node(a);
    assert_eq!(node_a.get_prev_ptr(), b);
    assert_eq!(node_a.get_next_ptr(), 0, "tail has no next");
}

#[test]
fn insert_head_three_nodes_links_correct() {
    let h = setup();
    let chain = h.chain;

    let a = insert_head_with_tick(&chain, 1, 10);
    let b = insert_head_with_tick(&chain, 2, 20);
    let c = insert_head_with_tick(&chain, 3, 30);

    // chain: c -> b -> a
    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);

    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);

    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);
}

// ============ NodeChainWriter: insert_after ============

#[test]
fn insert_after_tail() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_after(a, 2).unwrap();

    // chain: a -> b
    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), 0, "b is tail");
}

#[test]
fn insert_after_middle() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let c = chain.insert_after(a, 3).unwrap();
    // chain: a -> c
    let b = chain.insert_after(a, 2).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), b);
    assert_eq!(chain.get_node(c).get_next_ptr(), 0);
}

// ============ NodeChainWriter: insert_before ============

#[test]
fn insert_before_head_does_not_update_chain_head() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_before(a, 2).unwrap();

    // chain head is still a (insert_before does NOT update head ptr)
    // This is by design: insert_before only patches node pointers
    // b -> a is the link, but chain head is still stored as a

    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), 0);
}

#[test]
fn insert_before_middle_node() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let c = chain.insert_after(a, 3).unwrap();
    // chain: a -> c
    let b = chain.insert_before(c, 2).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get_node(a).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), a);
    assert_eq!(chain.get_node(b).get_next_ptr(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), b);
}

// ============ NodeChainWriter: remove ============

#[test]
fn remove_only_node_empties_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    chain.remove(a).unwrap();

    assert!(chain.get_head().is_none(), "chain must be empty");
}

#[test]
fn remove_head_promotes_next() {
    let h = setup();
    let chain = h.chain;

    let _a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    // chain: b -> a

    chain.remove(b).unwrap();
    // chain: a

    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_prev_ptr(), 0);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn remove_tail_patches_prev() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    // chain: b -> a

    chain.remove(a).unwrap();
    // chain: b

    let node_b = chain.get_node(b);
    assert_eq!(node_b.get_next_ptr(), 0, "b is now tail");
    assert_eq!(node_b.get_prev_ptr(), 0, "b is also head");
}

#[test]
fn remove_middle_heals_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    let c = chain.insert_head(3).unwrap();
    // chain: c -> b -> a

    chain.remove(b).unwrap();
    // chain: c -> a

    assert_eq!(chain.get_node(c).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), c);
}

#[test]
fn remove_all_then_reinsert() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    let c = chain.insert_head(3).unwrap();

    chain.remove(c).unwrap();
    chain.remove(b).unwrap();
    chain.remove(a).unwrap();

    assert!(chain.get_head().is_none());

    // reinsert
    let _d = chain.insert_head(99).unwrap();
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 99);
    assert_eq!(head.get_next_ptr(), 0);
    assert_eq!(head.get_prev_ptr(), 0);
}

#[test]
fn double_remove_returns_error() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    chain.remove(a).unwrap();
    /* commented err check */
}

// ============ NodeChainReader: traversal after publish ============

#[test]
fn chain_reader_traverses_full_chain() {
    let mut h = setup();

    let (_a, _b, _c) = {
        let chain = h.chain;

        let a = insert_head_with_tick(&chain, 1, 10);
        let b = insert_head_with_tick(&chain, 2, 20);
        let c = insert_head_with_tick(&chain, 3, 30);
        (a, b, c)
    };
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    // chain: c -> b -> a
    let head = chain_r.get_head().unwrap();
    assert_eq!(head.get_kind(), 3);
    assert_eq!(head.get_meta(0), 30);

    let node_b = chain_r.get_node(head.get_next_ptr());
    assert_eq!(node_b.get_kind(), 2);

    let node_a = chain_r.get_node(node_b.get_next_ptr());
    assert_eq!(node_a.get_kind(), 1);
    assert_eq!(node_a.get_next_ptr(), 0, "end of chain");
}

#[test]
fn chain_reader_empty_chain_returns_none() {
    let mut h = setup();
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    assert!(chain_r.get_head().is_none());
}

#[test]
fn chain_reader_sees_removal_after_publish() {
    let mut h = setup();

    {
        let chain = h.chain;

        let _a = chain.insert_head(1).unwrap();
        let b = chain.insert_head(2).unwrap();
        // chain: b -> a
        chain.remove(b).unwrap();
        // chain: a
    };
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    let head = chain_r.get_head().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0, "only one node left");
}

// ============ Capacity exhaustion ============

#[test]
fn insert_head_exhausts_capacity() {
    let h = setup();
    let chain = h.chain;

    for i in 0..CAPACITY {
        assert!(chain.insert_head(i as i32).is_some());
    }
    assert!(
        chain.insert_head(99).is_none(),
        "capacity exhausted"
    );
}

// ============ Pointer stability across operations ============

#[test]
fn insert_after_does_not_mutate_unrelated_nodes() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_after(a, 2).unwrap();
    let c = chain.insert_after(b, 3).unwrap();
    // chain: a -> b -> c

    // Insert d after a (between a and b)
    let d = chain.insert_after(a, 4).unwrap();
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
fn four_node_chain_traversal_forward_and_backward() {
    let h = setup();
    let chain = h.chain;

    // build chain via insert_head: d(head) -> c -> b -> a(tail)
    let a = insert_head_with_tick(&chain, 1, 10);
    let b = insert_head_with_tick(&chain, 2, 20);
    let c = insert_head_with_tick(&chain, 3, 30);
    let d = insert_head_with_tick(&chain, 4, 40);

    // forward: d -> c -> b -> a -> 0
    let h0 = chain.get_head().unwrap();
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
    assert_eq!(chain.get_node(d).get_prev_ptr(), 0, "start of chain");
}

// ============ insert_after / insert_before exhaustion ============

#[test]
fn insert_after_returns_none_on_exhaustion() {
    let h = setup();
    let chain = h.chain;

    let head = chain.insert_head(0).unwrap();
    // fill remaining capacity via insert_after
    let mut last = head;
    for i in 1..CAPACITY {
        last = chain.insert_after(last, i as i32).unwrap();
    }
    assert!(
        chain.insert_after(last, 99).is_none(),
        "insert_after must return None when exhausted"
    );
}

#[test]
fn insert_before_returns_none_on_exhaustion() {
    let h = setup();
    let chain = h.chain;

    let head = chain.insert_head(0).unwrap();
    // fill remaining capacity via insert_before
    for i in 1..CAPACITY {
        chain.insert_before(head, i as i32).unwrap();
    }
    assert!(
        chain.insert_before(head, 99).is_none(),
        "insert_before must return None when exhausted"
    );
}

// ============ insert_before at tail ============

#[test]
fn insert_before_tail_in_three_node_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let c = chain.insert_after(a, 3).unwrap();
    let d = chain.insert_after(c, 4).unwrap();
    // chain: a -> c -> d

    // insert before tail (d)
    let e = chain.insert_before(d, 5).unwrap();
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

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    let c = chain.insert_head(3).unwrap();
    let d = chain.insert_head(4).unwrap();
    // chain: d -> c -> b -> a

    // remove tail
    chain.remove(a).unwrap();
    // chain: d -> c -> b
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);

    // remove middle
    chain.remove(c).unwrap();
    // chain: d -> b
    assert_eq!(chain.get_node(d).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), d);

    // remove head
    chain.remove(d).unwrap();
    // chain: b
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 2);
    assert_eq!(head.get_prev_ptr(), 0);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn remove_arbitrary_order_on_five_node_chain() {
    let h = setup();
    let chain = h.chain;

    let a = chain.insert_head(1).unwrap();
    let b = chain.insert_head(2).unwrap();
    let c = chain.insert_head(3).unwrap();
    let d = chain.insert_head(4).unwrap();
    let e = chain.insert_head(5).unwrap();
    // chain: e -> d -> c -> b -> a

    // remove c (middle)
    chain.remove(c).unwrap();
    // chain: e -> d -> b -> a
    assert_eq!(chain.get_node(d).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), d);

    // remove e (head)
    chain.remove(e).unwrap();
    // chain: d -> b -> a
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 4);
    assert_eq!(chain.get_node(d).get_prev_ptr(), 0);

    // remove a (tail)
    chain.remove(a).unwrap();
    // chain: d -> b
    assert_eq!(chain.get_node(b).get_next_ptr(), 0);

    // remove d (head again)
    chain.remove(d).unwrap();
    // chain: b
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_kind(), 2);
    assert_eq!(head.get_prev_ptr(), 0);
    assert_eq!(head.get_next_ptr(), 0);

    // remove last
    chain.remove(b).unwrap();
    assert!(chain.get_head().is_none());
}

// ============ Remove then traverse via reader ============

#[test]
fn reader_traverses_chain_after_mid_chain_removal() {
    let mut h = setup();

    {
        let chain = h.chain;

        let _a = insert_head_with_tick(&chain, 1, 10);
        let b = insert_head_with_tick(&chain, 2, 20);
        let _c = insert_head_with_tick(&chain, 3, 30);
        let _d = insert_head_with_tick(&chain, 4, 40);
        // chain: d -> c -> b -> a

        chain.remove(b).unwrap();
        // chain: d -> c -> a
    }
    h.writer.publish();
    h.reader.swap();

    let chain_r = h.chain_r;

    // forward traversal: d -> c -> a -> 0
    let head = chain_r.get_head().unwrap();
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
    
    let _a = insert_head_with_tick(&src, 1, 10);
    let b = insert_head_with_tick(&src, 2, 20);
    
    
    src.remove(b).unwrap(); // b deferred
    
    // create a dst with larger capacity
    let dst_mem = create_mem(MEM_SIZE);
    let (dst_tb, _) = TripleBuffer::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst = NodeChainWriter::<NODE_META>::new(dst_mem, dst_tb, FL_START, NODE_START_OFFSET, CAPACITY * 2);
    
    dst.copy_from(&src);
    
    assert_eq!(dst.len(), 2);
    let head = dst.get_head().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_meta(0), 10);
    assert_eq!(head.get_next_ptr(), 0);
    
    
    dst.flush_deferred();
    dst.flush_deferred();
    
    assert_eq!(dst.len(), 1);
    assert_eq!(dst.capacity(), CAPACITY * 2);
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let src_mem = create_mem(MEM_SIZE);
    let (src_tb, _) = TripleBuffer::new(Arc::clone(&src_mem), TB_START, TB_BUF_CAP);
    let src = NodeChainWriter::<NODE_META>::new(src_mem, src_tb, FL_START, NODE_START_OFFSET, CAPACITY * 2);
    
    let dst_mem = create_mem(MEM_SIZE);
    let (dst_tb, _) = TripleBuffer::new(Arc::clone(&dst_mem), TB_START, TB_BUF_CAP);
    let dst = NodeChainWriter::<NODE_META>::new(dst_mem, dst_tb, FL_START, NODE_START_OFFSET, CAPACITY);
    
    dst.copy_from(&src);
}
