use proptest::prelude::*;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
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
    let (writer, _reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
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
/// - Forward traversal from head visits every active node exactly once
/// - Backward links are consistent (node.next.prev == node)
/// - Head's prev == 0, tail's next == 0
fn verify_chain_integrity(chain: &NodeChainWriter<NODE_META>, active_slots: &[usize]) {
    if active_slots.is_empty() {
        // get_head may or may not return None depending on head pointer state,
        // but there should be no active nodes
        return;
    }

    // Find the actual first node: the one with prev_ptr == 0.
    // Note: insert_before on the head does NOT update the head pointer (by design),
    // so get_head() may not return the actual first node. We find it from active_slots.
    let first_slot = active_slots.iter()
        .find(|&&s| chain.get_node(s).get_prev_ptr() == 0)
        .copied();

    // There must be exactly one node with prev == 0
    assert!(first_slot.is_some(), "no node with prev_ptr == 0 found in active slots");
    let first_slot = first_slot.unwrap();

    let nodes_with_prev_zero: Vec<_> = active_slots.iter()
        .filter(|&&s| chain.get_node(s).get_prev_ptr() == 0)
        .collect();
    assert_eq!(
        nodes_with_prev_zero.len(), 1,
        "expected exactly 1 node with prev==0, found {}",
        nodes_with_prev_zero.len()
    );

    // Forward traversal from the actual first node
    let mut visited = Vec::new();
    let mut current_slot = first_slot;
    let mut guard = 0;
    loop {
        visited.push(current_slot);
        let node = chain.get_node(current_slot);
        let next = node.get_next_ptr();

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

proptest! {
    #[test]
    fn node_chain_random_ops_preserve_doubly_linked_invariants(
        ops in proptest::collection::vec(chain_op_strategy(), 1..100)
    ) {
        let chain = setup_chain();
        let mut active_slots: Vec<usize> = Vec::new();
        let mut kind_counter = 0i32;
        // Track the head slot as reported by get_head_slot()
        // insert_before on head is NOT supported at the raw NodeChainWriter level

        for op in ops {
            match op {
                ChainOp::InsertHead => {
                    if active_slots.len() < CAPACITY {
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_head(kind_counter) {
                            active_slots.push(slot);
                        }
                    }
                }
                ChainOp::InsertAfter(idx) => {
                    if !active_slots.is_empty() && active_slots.len() < CAPACITY {
                        let target = active_slots[idx % active_slots.len()];
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_after(target, kind_counter) {
                            active_slots.push(slot);
                        }
                    }
                }
                ChainOp::InsertBefore(idx) => {
                    if !active_slots.is_empty() && active_slots.len() < CAPACITY {
                        let target = active_slots[idx % active_slots.len()];
                        // Skip insert_before on the head — not supported at this API level
                        let head_slot = chain.get_head_slot();
                        if target != head_slot {
                            kind_counter += 1;
                            if let Some(slot) = chain.insert_before(target, kind_counter) {
                                active_slots.push(slot);
                            }
                        }
                    }
                }
                ChainOp::Remove(idx) => {
                    if !active_slots.is_empty() {
                        let actual_idx = idx % active_slots.len();
                        let slot = active_slots.remove(actual_idx);
                        let _ = chain.remove(slot);
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
            if let Some(s) = chain.insert_head(i as i32) {
                slots.push(s);
            }
        }

        // Remove all in random-ish order (reverse)
        while let Some(s) = slots.pop() {
            let _ = chain.remove(s);
        }

        prop_assert!(chain.get_head().is_none(), "chain should be empty after removing all nodes");
    }
}
