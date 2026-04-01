use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::constants::NODE_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
use symphonyscript_kernel::structural_plane::structural_writer::StructuralWriter;
use symphonyscript_kernel::structural_plane::structural_reader::StructuralReader;
use symphonyscript_kernel::structural_plane::node::node_chain_writer::NodeChainWriter;
use symphonyscript_kernel::structural_plane::node::node_chain_reader::NodeChainReader;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;

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
    writer: symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader,
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

// ============ NodeChainWriter: insert_head ============

#[test]
fn insert_head_into_empty_chain() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    assert!(chain.get_head().is_none());

    let slot = chain.insert_head(make_draft(1, 0)).unwrap();
    let head = chain.get_head().unwrap();

    assert_eq!(head.get_opcode(), 1);
    assert_eq!(head.get_next_ptr(), 0, "single node: next = null");
    assert_eq!(head.get_prev_ptr(), 0, "single node: prev = null");
    assert_eq!(slot, 1, "first alloc = slot 1");
}

#[test]
fn insert_head_pushes_existing_head() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();

    // chain: b -> a
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 2, "head is b");

    let node_b = chain.get(b);
    assert_eq!(node_b.get_next_ptr(), a);
    assert_eq!(node_b.get_prev_ptr(), 0, "head has no prev");

    let node_a = chain.get(a);
    assert_eq!(node_a.get_prev_ptr(), b);
    assert_eq!(node_a.get_next_ptr(), 0, "tail has no next");
}

#[test]
fn insert_head_three_nodes_links_correct() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 10)).unwrap();
    let b = chain.insert_head(make_draft(2, 20)).unwrap();
    let c = chain.insert_head(make_draft(3, 30)).unwrap();

    // chain: c -> b -> a
    assert_eq!(chain.get(c).get_prev_ptr(), 0);
    assert_eq!(chain.get(c).get_next_ptr(), b);

    assert_eq!(chain.get(b).get_prev_ptr(), c);
    assert_eq!(chain.get(b).get_next_ptr(), a);

    assert_eq!(chain.get(a).get_prev_ptr(), b);
    assert_eq!(chain.get(a).get_next_ptr(), 0);
}

// ============ NodeChainWriter: insert_after ============

#[test]
fn insert_after_tail() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_after(a, make_draft(2, 0)).unwrap();

    // chain: a -> b
    assert_eq!(chain.get(a).get_next_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), a);
    assert_eq!(chain.get(b).get_next_ptr(), 0, "b is tail");
}

#[test]
fn insert_after_middle() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let c = chain.insert_after(a, make_draft(3, 0)).unwrap();
    // chain: a -> c
    let b = chain.insert_after(a, make_draft(2, 0)).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get(a).get_next_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), a);
    assert_eq!(chain.get(b).get_next_ptr(), c);
    assert_eq!(chain.get(c).get_prev_ptr(), b);
    assert_eq!(chain.get(c).get_next_ptr(), 0);
}

// ============ NodeChainWriter: insert_before ============

#[test]
fn insert_before_head_does_not_update_chain_head() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_before(a, make_draft(2, 0)).unwrap();

    // chain head is still a (insert_before does NOT update head ptr)
    // This is by design: insert_before only patches node pointers
    // b -> a is the link, but chain head is still stored as a

    assert_eq!(chain.get(b).get_next_ptr(), a);
    assert_eq!(chain.get(a).get_prev_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), 0);
}

#[test]
fn insert_before_middle_node() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let c = chain.insert_after(a, make_draft(3, 0)).unwrap();
    // chain: a -> c
    let b = chain.insert_before(c, make_draft(2, 0)).unwrap();
    // chain: a -> b -> c

    assert_eq!(chain.get(a).get_next_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), a);
    assert_eq!(chain.get(b).get_next_ptr(), c);
    assert_eq!(chain.get(c).get_prev_ptr(), b);
}

// ============ NodeChainWriter: remove ============

#[test]
fn remove_only_node_empties_chain() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    chain.remove(a).unwrap();

    assert!(chain.get_head().is_none(), "chain must be empty");
}

#[test]
fn remove_head_promotes_next() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    // chain: b -> a

    chain.remove(b).unwrap();
    // chain: a

    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 1);
    assert_eq!(head.get_prev_ptr(), 0);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn remove_tail_patches_prev() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    // chain: b -> a

    chain.remove(a).unwrap();
    // chain: b

    let node_b = chain.get(b);
    assert_eq!(node_b.get_next_ptr(), 0, "b is now tail");
    assert_eq!(node_b.get_prev_ptr(), 0, "b is also head");
}

#[test]
fn remove_middle_heals_chain() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    let c = chain.insert_head(make_draft(3, 0)).unwrap();
    // chain: c -> b -> a

    chain.remove(b).unwrap();
    // chain: c -> a

    assert_eq!(chain.get(c).get_next_ptr(), a);
    assert_eq!(chain.get(a).get_prev_ptr(), c);
}

#[test]
fn remove_all_then_reinsert() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    let c = chain.insert_head(make_draft(3, 0)).unwrap();

    chain.remove(c).unwrap();
    chain.remove(b).unwrap();
    chain.remove(a).unwrap();

    assert!(chain.get_head().is_none());

    // reinsert
    let d = chain.insert_head(make_draft(99, 0)).unwrap();
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 99);
    assert_eq!(head.get_next_ptr(), 0);
    assert_eq!(head.get_prev_ptr(), 0);
}

#[test]
fn double_remove_returns_error() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    assert!(chain.remove(a).is_ok());
    assert!(chain.remove(a).is_err(), "double remove must error");
}

// ============ NodeChainReader: traversal after publish ============

#[test]
fn chain_reader_traverses_full_chain() {
    let mut h = setup();

    let (a, b, c) = {
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

        let a = chain.insert_head(make_draft(1, 10)).unwrap();
        let b = chain.insert_head(make_draft(2, 20)).unwrap();
        let c = chain.insert_head(make_draft(3, 30)).unwrap();
        (a, b, c)
    };
    h.writer.publish();
    h.reader.swap();

    let sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, CAPACITY);
    let chain_r = NodeChainReader::new(&h.reader, &sr, HEAD_OFFSET);

    // chain: c -> b -> a
    let head = chain_r.get_head().unwrap();
    assert_eq!(head.get_opcode(), 3);
    assert_eq!(head.get_base_tick(), 30);

    let node_b = chain_r.get(head.get_next_ptr());
    assert_eq!(node_b.get_opcode(), 2);

    let node_a = chain_r.get(node_b.get_next_ptr());
    assert_eq!(node_a.get_opcode(), 1);
    assert_eq!(node_a.get_next_ptr(), 0, "end of chain");
}

#[test]
fn chain_reader_empty_chain_returns_none() {
    let mut h = setup();
    h.writer.publish();
    h.reader.swap();

    let sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, CAPACITY);
    let chain_r = NodeChainReader::new(&h.reader, &sr, HEAD_OFFSET);

    assert!(chain_r.get_head().is_none());
}

#[test]
fn chain_reader_sees_removal_after_publish() {
    let mut h = setup();

    {
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

        let a = chain.insert_head(make_draft(1, 0)).unwrap();
        let b = chain.insert_head(make_draft(2, 0)).unwrap();
        // chain: b -> a
        chain.remove(b).unwrap();
        // chain: a
    };
    h.writer.publish();
    h.reader.swap();

    let sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, CAPACITY);
    let chain_r = NodeChainReader::new(&h.reader, &sr, HEAD_OFFSET);

    let head = chain_r.get_head().unwrap();
    assert_eq!(head.get_opcode(), 1);
    assert_eq!(head.get_next_ptr(), 0, "only one node left");
}

// ============ Capacity exhaustion ============

#[test]
fn insert_head_exhausts_capacity() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    for i in 0..CAPACITY {
        assert!(chain.insert_head(make_draft(i as i32, 0)).is_some());
    }
    assert!(chain.insert_head(make_draft(99, 0)).is_none(), "capacity exhausted");
}

// ============ Pointer stability across operations ============

#[test]
fn insert_after_does_not_mutate_unrelated_nodes() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_after(a, make_draft(2, 0)).unwrap();
    let c = chain.insert_after(b, make_draft(3, 0)).unwrap();
    // chain: a -> b -> c

    // Insert d after a (between a and b)
    let d = chain.insert_after(a, make_draft(4, 0)).unwrap();
    // chain: a -> d -> b -> c

    // c must not be touched
    assert_eq!(chain.get(c).get_prev_ptr(), b, "c's prev unchanged");
    assert_eq!(chain.get(c).get_next_ptr(), 0, "c's next unchanged");

    // b's prev updated to d
    assert_eq!(chain.get(b).get_prev_ptr(), d);
    // b's next unchanged
    assert_eq!(chain.get(b).get_next_ptr(), c);
}

// ============ Forward + backward traversal ============

#[test]
fn four_node_chain_traversal_forward_and_backward() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    // build chain via insert_head: d(head) -> c -> b -> a(tail)
    let a = chain.insert_head(make_draft(1, 10)).unwrap();
    let b = chain.insert_head(make_draft(2, 20)).unwrap();
    let c = chain.insert_head(make_draft(3, 30)).unwrap();
    let d = chain.insert_head(make_draft(4, 40)).unwrap();

    // forward: d -> c -> b -> a -> 0
    let h0 = chain.get_head().unwrap();
    assert_eq!(h0.get_opcode(), 4);
    let n1 = chain.get(h0.get_next_ptr());
    assert_eq!(n1.get_opcode(), 3);
    let n2 = chain.get(n1.get_next_ptr());
    assert_eq!(n2.get_opcode(), 2);
    let n3 = chain.get(n2.get_next_ptr());
    assert_eq!(n3.get_opcode(), 1);
    assert_eq!(n3.get_next_ptr(), 0, "end of chain");

    // backward: a -> b -> c -> d -> 0
    assert_eq!(chain.get(a).get_prev_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), c);
    assert_eq!(chain.get(c).get_prev_ptr(), d);
    assert_eq!(chain.get(d).get_prev_ptr(), 0, "start of chain");
}

// ============ insert_after / insert_before exhaustion ============

#[test]
fn insert_after_returns_none_on_exhaustion() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let head = chain.insert_head(make_draft(0, 0)).unwrap();
    // fill remaining capacity via insert_after
    let mut last = head;
    for i in 1..CAPACITY {
        last = chain.insert_after(last, make_draft(i as i32, 0)).unwrap();
    }
    assert!(
        chain.insert_after(last, make_draft(99, 0)).is_none(),
        "insert_after must return None when exhausted"
    );
}

#[test]
fn insert_before_returns_none_on_exhaustion() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let head = chain.insert_head(make_draft(0, 0)).unwrap();
    // fill remaining capacity via insert_before
    for i in 1..CAPACITY {
        chain.insert_before(head, make_draft(i as i32, 0)).unwrap();
    }
    assert!(
        chain.insert_before(head, make_draft(99, 0)).is_none(),
        "insert_before must return None when exhausted"
    );
}

// ============ insert_before at tail ============

#[test]
fn insert_before_tail_in_three_node_chain() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let c = chain.insert_after(a, make_draft(3, 0)).unwrap();
    let d = chain.insert_after(c, make_draft(4, 0)).unwrap();
    // chain: a -> c -> d

    // insert before tail (d)
    let e = chain.insert_before(d, make_draft(5, 0)).unwrap();
    // chain: a -> c -> e -> d

    assert_eq!(chain.get(c).get_next_ptr(), e);
    assert_eq!(chain.get(e).get_prev_ptr(), c);
    assert_eq!(chain.get(e).get_next_ptr(), d);
    assert_eq!(chain.get(d).get_prev_ptr(), e);
    assert_eq!(chain.get(d).get_next_ptr(), 0, "d is still tail");
}

// ============ Multi-order removal ============

#[test]
fn remove_tail_first_then_middle_then_head() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    let c = chain.insert_head(make_draft(3, 0)).unwrap();
    let d = chain.insert_head(make_draft(4, 0)).unwrap();
    // chain: d -> c -> b -> a

    // remove tail
    chain.remove(a).unwrap();
    // chain: d -> c -> b
    assert_eq!(chain.get(b).get_next_ptr(), 0);

    // remove middle
    chain.remove(c).unwrap();
    // chain: d -> b
    assert_eq!(chain.get(d).get_next_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), d);

    // remove head
    chain.remove(d).unwrap();
    // chain: b
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 2);
    assert_eq!(head.get_prev_ptr(), 0);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn remove_arbitrary_order_on_five_node_chain() {
    let h = setup();
    let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
    let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

    let a = chain.insert_head(make_draft(1, 0)).unwrap();
    let b = chain.insert_head(make_draft(2, 0)).unwrap();
    let c = chain.insert_head(make_draft(3, 0)).unwrap();
    let d = chain.insert_head(make_draft(4, 0)).unwrap();
    let e = chain.insert_head(make_draft(5, 0)).unwrap();
    // chain: e -> d -> c -> b -> a

    // remove c (middle)
    chain.remove(c).unwrap();
    // chain: e -> d -> b -> a
    assert_eq!(chain.get(d).get_next_ptr(), b);
    assert_eq!(chain.get(b).get_prev_ptr(), d);

    // remove e (head)
    chain.remove(e).unwrap();
    // chain: d -> b -> a
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 4);
    assert_eq!(chain.get(d).get_prev_ptr(), 0);

    // remove a (tail)
    chain.remove(a).unwrap();
    // chain: d -> b
    assert_eq!(chain.get(b).get_next_ptr(), 0);

    // remove d (head again)
    chain.remove(d).unwrap();
    // chain: b
    let head = chain.get_head().unwrap();
    assert_eq!(head.get_opcode(), 2);
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
        let sw = StructuralWriter::<NODE_SLOT_SIZE>::new(&h.writer, &h.free_list, NODE_START_OFFSET, CAPACITY);
        let chain = NodeChainWriter::new(&h.writer, &sw, HEAD_OFFSET);

        let _a = chain.insert_head(make_draft(1, 10)).unwrap();
        let b = chain.insert_head(make_draft(2, 20)).unwrap();
        let _c = chain.insert_head(make_draft(3, 30)).unwrap();
        let _d = chain.insert_head(make_draft(4, 40)).unwrap();
        // chain: d -> c -> b -> a

        chain.remove(b).unwrap();
        // chain: d -> c -> a
    }
    h.writer.publish();
    h.reader.swap();

    let sr = StructuralReader::<NODE_SLOT_SIZE>::new(&h.reader, NODE_START_OFFSET, CAPACITY);
    let chain_r = NodeChainReader::new(&h.reader, &sr, HEAD_OFFSET);

    // forward traversal: d -> c -> a -> 0
    let head = chain_r.get_head().unwrap();
    assert_eq!(head.get_opcode(), 4);
    assert_eq!(head.get_base_tick(), 40);

    let n1 = chain_r.get(head.get_next_ptr());
    assert_eq!(n1.get_opcode(), 3);

    let n2 = chain_r.get(n1.get_next_ptr());
    assert_eq!(n2.get_opcode(), 1);
    assert_eq!(n2.get_next_ptr(), 0, "end of chain");
}
