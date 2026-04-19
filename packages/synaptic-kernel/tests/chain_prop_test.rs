use proptest::prelude::*;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;

const NODE_META: usize = 8;
const MEM_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const FL_START: usize = 50000;
const NODE_START_OFFSET: usize = 0;
const CAPACITY: usize = 64;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn setup_chain() -> NodeChainWriter<NODE_META> {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    NodeChainWriter::<NODE_META>::new(
        mem,
        writer,
        FL_START,
        NODE_START_OFFSET,
        CAPACITY,
    )
}

#[derive(Debug, Clone)]
enum ChainOp {
    InsertHead,
    InsertAfter(usize),  // index into active slots
    InsertBefore(usize), // index into active slots
    Remove(usize),       // index into active slots
}

fn chain_op_strategy() -> impl Strategy<Value = ChainOp> {
    prop_oneof![
        3 => Just(ChainOp::InsertHead),
        2 => (0..64usize).prop_map(ChainOp::InsertAfter),
        2 => (0..64usize).prop_map(ChainOp::InsertBefore),
        2 => (0..64usize).prop_map(ChainOp::Remove),
    ]
}

/// Verify that a chain is a valid doubly-linked list:
/// - get_head() returns the actual first node (prev == 0)
/// - Forward traversal from head visits every active node exactly once
/// - Backward links are consistent (node.next.prev == node)
/// - Head's prev == 0, tail's next == 0
fn verify_chain_integrity(chain: &NodeChainWriter<NODE_META>, active_slots: &[usize]) {
    if active_slots.is_empty() {
        assert!(chain.get_head_node().is_none(), "empty active set but chain has head");
        return;
    }

    // get_head() must return a valid node
    let head = chain.get_head_node();
    assert!(head.is_some(), "non-empty active set but chain has no head");
    let head = head.unwrap();

    // Head's prev must be 0
    assert_eq!(head.get_prev_ptr(), 0, "head's prev must be 0");

    // Find the head slot from active_slots
    let head_slot = chain.get_head_slot();
    assert!(
        active_slots.contains(&head_slot),
        "head slot {} not in active slots {:?}",
        head_slot, active_slots
    );

    // Forward traversal from head
    let mut visited = Vec::new();
    let mut current_slot = head_slot;
    let mut guard = 0;
    loop {
        visited.push(current_slot);
        let node = chain.get_node(current_slot);
        let next: usize = node.get_next_ptr();

        if next == 0 {
            break;
        }

        // Verify backward link consistency
        let next_node = chain.get_node(next);
        assert_eq!(
            next_node.get_prev_ptr(), current_slot,
            "backward link broken: node {}'s next is {}, but {}'s prev is {}",
            current_slot, next, next, next_node.get_prev_ptr()
        );

        current_slot = next;
        guard += 1;
        assert!(guard <= CAPACITY, "cycle detected in chain traversal");
    }

    // Every active slot should be visited exactly once
    assert_eq!(
        visited.len(), active_slots.len(),
        "traversal visited {} nodes but {} are active. visited: {:?}, active: {:?}",
        visited.len(), active_slots.len(), visited, active_slots
    );

    let mut visited_sorted = visited.clone();
    visited_sorted.sort();
    visited_sorted.dedup();
    assert_eq!(
        visited_sorted.len(), visited.len(),
        "duplicate nodes in traversal"
    );

    for &s in active_slots {
        assert!(
            visited.contains(&s),
            "active slot {} not visited during traversal",
            s
        );
    }
}

// ============ Explicit insert_before on head tests ============

#[test]
fn insert_before_head_updates_head_pointer() {
    let chain = setup_chain();

    let a = chain.insert_head_node(1).unwrap();
    assert_eq!(chain.get_head_slot(), a);

    let b = chain.insert_node_before(a, 2).unwrap();

    // Head pointer must now point to b
    assert_eq!(chain.get_head_slot(), b, "insert_before head must update head pointer");
    assert_eq!(chain.get_head_node().unwrap().get_kind(), 2);

    // Chain: b -> a
    assert_eq!(chain.get_node(b).get_prev_ptr(), 0, "new head's prev must be 0");
    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);
}

#[test]
fn insert_before_head_twice_builds_correct_chain() {
    let chain = setup_chain();

    let a = chain.insert_head_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    let c = chain.insert_node_before(b, 3).unwrap();

    // Chain: c -> b -> a
    assert_eq!(chain.get_head_slot(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);

    verify_chain_integrity(&chain, &[a, b, c]);
}

#[test]
fn insert_before_head_then_insert_head_interleaved() {
    let chain = setup_chain();

    let a = chain.insert_head_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    // chain: b -> a
    let c = chain.insert_head_node(3).unwrap();
    // chain: c -> b -> a

    assert_eq!(chain.get_head_slot(), c);
    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);

    verify_chain_integrity(&chain, &[a, b, c]);
}

#[test]
fn remove_node_inserted_before_head() {
    let chain = setup_chain();

    let a = chain.insert_head_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    // chain: b -> a

    chain.remove_node(b).unwrap();
    // chain: a (head should revert to a)

    assert_eq!(chain.get_head_slot(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);

    verify_chain_integrity(&chain, &[a]);
}

// ============ Property-based tests ============

proptest! {
    #[test]
    fn node_chain_random_ops_preserve_doubly_linked_invariants(
        ops in proptest::collection::vec(chain_op_strategy(), 1..100)
    ) {
        let chain = setup_chain();
        let mut active_slots: Vec<usize> = Vec::new();
        let mut kind_counter = 0i32;

        for op in ops {
            match op {
                ChainOp::InsertHead => {
                    if active_slots.len() < CAPACITY {
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_head_node(kind_counter) {
                            active_slots.push(slot);
                        }
                    }
                }
                ChainOp::InsertAfter(idx) => {
                    if !active_slots.is_empty() && active_slots.len() < CAPACITY {
                        let target = active_slots[idx % active_slots.len()];
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_node_after(target, kind_counter) {
                            active_slots.push(slot);
                        }
                    }
                }
                ChainOp::InsertBefore(idx) => {
                    if !active_slots.is_empty() && active_slots.len() < CAPACITY {
                        let target = active_slots[idx % active_slots.len()];
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_node_before(target, kind_counter) {
                            active_slots.push(slot);
                        }
                    }
                }
                ChainOp::Remove(idx) => {
                    if !active_slots.is_empty() {
                        let actual_idx = idx % active_slots.len();
                        let slot = active_slots.remove(actual_idx);
                        let _ = chain.remove_node(slot);
                    }
                }
            }

            // INVARIANT: chain is a valid doubly-linked list after every operation
            verify_chain_integrity(&chain, &active_slots);
        }
    }

    #[test]
    fn node_chain_insert_remove_all_leaves_empty(
        count in 1..32usize
    ) {
        let chain = setup_chain();
        let mut slots = Vec::new();

        for i in 0..count {
            if let Some(s) = chain.insert_head_node(i as i32) {
                slots.push(s);
            }
        }

        // Remove all in random-ish order (reverse)
        while let Some(s) = slots.pop() {
            let _ = chain.remove_node(s);
        }

        prop_assert!(chain.get_head_node().is_none(), "chain should be empty after removing all nodes");
    }
}
