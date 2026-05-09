use proptest::prelude::*;
use std::collections::HashSet;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_store_config::NodeStoreConfig;
use synaptic_kernel::topology::node::node_store_writer::NodeStoreWriter;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const MEM_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const FL_START: usize = 50000;
const NODE_START_OFFSET: usize = 0;
const CAPACITY: usize = 64;

fn create_mem(size: usize) -> AtomicBuffer {
    (0..size).map(|_| AtomicI32::new(0)).collect()
}

fn setup_chain() -> NodeStoreWriter {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    NodeStoreWriter::new(
        mem,
        writer,
        NodeStoreConfig {
            meta_stride: NODE_META,
            attr_stride: NODE_ATTR,
            capacity: CAPACITY,
        },
        FL_START,
        NODE_START_OFFSET,
    )
}

#[derive(Debug, Clone)]
enum ChainOp {
    InsertOrphan,
    InsertAfter(usize),  // index into active slots
    InsertBefore(usize), // index into active slots
    Remove(usize),       // index into active slots
}

fn chain_op_strategy() -> impl Strategy<Value = ChainOp> {
    prop_oneof![
        3 => Just(ChainOp::InsertOrphan),
        2 => (0..64usize).prop_map(ChainOp::InsertAfter),
        2 => (0..64usize).prop_map(ChainOp::InsertBefore),
        2 => (0..64usize).prop_map(ChainOp::Remove),
    ]
}

/// Active slots form one or more disjoint doubly-linked sub-chains (orphans count
/// as length-1). Each sub-chain head has prev_ptr == 0; forward traversal from
/// every head covers all active slots exactly once.
fn verify_chain_integrity(chain: &NodeStoreWriter, active_slots: &[usize]) {
    if active_slots.is_empty() {
        // Deferred frees can leave len > 0 until publish drains the allocator.
        return;
    }

    let active: HashSet<usize> = active_slots.iter().copied().collect();
    let mut global_visited: HashSet<usize> = HashSet::new();

    let mut heads: Vec<usize> = Vec::new();
    for &s in active_slots {
        let prev = chain.get_node(s).get_prev_ptr();
        if prev == 0 || !active.contains(&prev) {
            heads.push(s);
        }
    }

    for head_slot in heads {
        assert_eq!(
            chain.get_node(head_slot).get_prev_ptr(),
            0,
            "sub-chain entry must have prev_ptr 0"
        );
        let mut current = head_slot;
        let mut guard = 0;
        loop {
            assert!(
                active.contains(&current),
                "traversal left active set at {}",
                current
            );
            assert!(
                !global_visited.contains(&current),
                "slot {} appears in more than one component",
                current
            );
            global_visited.insert(current);

            let node = chain.get_node(current);
            let next = node.get_next_ptr();
            if next == 0 {
                break;
            }
            assert!(active.contains(&next), "next_ptr leaves active set");
            assert_eq!(
                chain.get_node(next).get_prev_ptr(),
                current,
                "backward link broken at {} -> {}",
                current,
                next
            );
            current = next;
            guard += 1;
            assert!(guard <= CAPACITY, "cycle detected in sub-chain");
        }
    }

    assert_eq!(
        global_visited.len(),
        active.len(),
        "visited {} of {:?} but active is {:?}",
        global_visited.len(),
        global_visited,
        active_slots
    );
}

#[test]
fn insert_before_makes_new_subchain_head() {
    let chain = setup_chain();

    let a = chain.insert_node(1).unwrap();
    assert_eq!(chain.get_node(a).get_prev_ptr(), 0);

    let b = chain.insert_node_before(a, 2).unwrap();

    assert_eq!(chain.get_node(b).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(b).get_kind(), 2);

    // Chain: b -> a
    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);
}

#[test]
fn insert_before_head_twice_builds_correct_chain() {
    let chain = setup_chain();

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    let c = chain.insert_node_before(b, 3).unwrap();

    // Chain: c -> b -> a
    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);
    assert_eq!(chain.get_node(a).get_prev_ptr(), b);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);

    verify_chain_integrity(&chain, &[a, b, c]);
}

#[test]
fn prepend_twice_to_form_three_node_subchain() {
    let chain = setup_chain();

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    // b -> a
    let c = chain.insert_node_before(b, 3).unwrap();
    // c -> b -> a

    assert_eq!(chain.get_node(c).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(c).get_next_ptr(), b);
    assert_eq!(chain.get_node(b).get_prev_ptr(), c);
    assert_eq!(chain.get_node(b).get_next_ptr(), a);

    verify_chain_integrity(&chain, &[a, b, c]);
}

#[test]
fn remove_prepended_node_restores_prior_subchain_head() {
    let chain = setup_chain();

    let a = chain.insert_node(1).unwrap();
    let b = chain.insert_node_before(a, 2).unwrap();
    // chain: b -> a

    chain.remove_node(b).unwrap();
    // chain: a

    assert_eq!(chain.get_node(a).get_prev_ptr(), 0);
    assert_eq!(chain.get_node(a).get_next_ptr(), 0);

    verify_chain_integrity(&chain, &[a]);
}

proptest! {
    #[test]
    fn node_store_random_ops_preserve_doubly_linked_invariants(
        ops in proptest::collection::vec(chain_op_strategy(), 1..100)
    ) {
        let chain = setup_chain();
        let mut active_slots: Vec<usize> = Vec::new();
        let mut kind_counter = 0i32;

        for op in ops {
            match op {
                ChainOp::InsertOrphan => {
                    if active_slots.len() < CAPACITY {
                        kind_counter += 1;
                        if let Some(slot) = chain.insert_node(kind_counter) {
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

            verify_chain_integrity(&chain, &active_slots);
        }
    }

    #[test]
    fn node_store_insert_remove_all_leaves_empty(
        count in 1..32usize
    ) {
        let chain = setup_chain();
        let mut slots = Vec::new();

        for i in 0..count {
            if let Some(s) = chain.insert_node(i as i32) {
                slots.push(s);
            }
        }

        while let Some(s) = slots.pop() {
            let _ = chain.remove_node(s);
        }

        chain.publish();
        chain.to_reader().ack_generation();
        chain.publish();
        prop_assert_eq!(chain.len(), 0);
    }
}
