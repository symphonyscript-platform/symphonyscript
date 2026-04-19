use proptest::prelude::*;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::constants::NODE_STRIDE;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::node::node_chain_writer::NodeChainWriter;
use synaptic_kernel::topology::network::network_writer::NetworkWriter;

const NODE_META: usize = 8;
const SYNAPSE_META: usize = 8;
const MEM_SIZE: usize = 131072;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 32768;
const NODE_CAPACITY: usize = 32;
const SYNAPSE_CAPACITY: usize = 64;
const NODE_START_OFFSET: usize = 0;
const SYNAPSE_START_OFFSET: usize = 1 + NODE_CAPACITY * (NODE_STRIDE + NODE_META);
const NODE_FL_START: usize = 80000;
const SYNAPSE_FL_START: usize = 90000;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

struct TestHarness {
    node_chain: NodeChainWriter<NODE_META>,
    synapse_chain: NetworkWriter<NODE_META, SYNAPSE_META>,
}

fn setup() -> TestHarness {
    let mem = create_mem(MEM_SIZE);
    let writer = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    let node_chain = NodeChainWriter::<NODE_META>::new(
        Arc::clone(&mem),
        writer.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = NetworkWriter::<NODE_META, SYNAPSE_META>::new(
        Arc::clone(&mem),
        writer.clone(),
        node_chain.clone(),
        SYNAPSE_FL_START,
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );
    TestHarness {
        node_chain,
        synapse_chain,
    }
}

/// Tracks the graph state for verification
struct GraphState {
    node_slots: Vec<usize>,
    /// (synapse_slot, source_node, target_node)
    synapse_edges: Vec<(usize, usize, usize)>,
}

impl GraphState {
    fn new() -> Self {
        GraphState {
            node_slots: Vec::new(),
            synapse_edges: Vec::new(),
        }
    }
}

/// Verify all synapse chain invariants:
/// - For each node: outgoing chain is a valid doubly-linked list
/// - For each node: incoming chain is a valid doubly-linked list
/// - Every active synapse is reachable from its source's outgoing chain AND target's incoming chain
/// - head/tail pointers are consistent: head.prev == 0, tail.next == 0
fn verify_synapse_integrity(
    h: &TestHarness,
    state: &GraphState,
) {
    // Collect all active synapses by source and by target
    let mut outgoing_by_node: std::collections::HashMap<usize, Vec<usize>> =
        std::collections::HashMap::new();
    let mut incoming_by_node: std::collections::HashMap<usize, Vec<usize>> =
        std::collections::HashMap::new();

    for &(syn_slot, src, tgt) in &state.synapse_edges {
        outgoing_by_node.entry(src).or_default().push(syn_slot);
        incoming_by_node.entry(tgt).or_default().push(syn_slot);
    }

    // Verify outgoing chains for all nodes
    for &node_slot in &state.node_slots {
        let node = h.node_chain.get_node(node_slot);
        let expected_out = outgoing_by_node.get(&node_slot);
        let expected_count = expected_out.map_or(0, |v| v.len());

        if expected_count == 0 {
            assert_eq!(
                node.get_outgoing_synapse_head(), 0,
                "node {} has no outgoing synapses but head != 0", node_slot
            );
            assert_eq!(
                node.get_outgoing_synapse_tail(), 0,
                "node {} has no outgoing synapses but tail != 0", node_slot
            );
            continue;
        }

        // Walk outgoing chain
        let head = node.get_outgoing_synapse_head();
        assert!(head > 0, "node {} has outgoing synapses but head == 0", node_slot);

        let head_syn = h.synapse_chain.get_synapse(head);
        assert_eq!(
            head_syn.get_outgoing_prev_ptr(), 0,
            "outgoing head synapse {}'s prev must be 0", head
        );

        let mut visited = Vec::new();
        let mut current = head;
        let mut last = 0;
        let mut guard = 0;
        while current != 0 {
            visited.push(current);
            let syn = h.synapse_chain.get_synapse(current);

            // Verify source pointer
            assert_eq!(
                syn.get_source_ptr(), node_slot,
                "synapse {} source should be {} but is {}", current, node_slot, syn.get_source_ptr()
            );

            last = current;
            current = syn.get_outgoing_next_ptr();

            // Verify backward link
            if current != 0 {
                let next_syn = h.synapse_chain.get_synapse(current);
                assert_eq!(
                    next_syn.get_outgoing_prev_ptr(), last,
                    "outgoing backward link broken at synapse {}", current
                );
            }

            guard += 1;
            assert!(guard <= SYNAPSE_CAPACITY, "cycle in outgoing chain of node {}", node_slot);
        }

        // Verify tail
        assert_eq!(
            node.get_outgoing_synapse_tail(), last,
            "node {} outgoing tail should be {} but is {}", node_slot, last, node.get_outgoing_synapse_tail()
        );

        // All expected synapses should be visited
        let expected_set: std::collections::HashSet<usize> =
            expected_out.unwrap().iter().cloned().collect();
        let visited_set: std::collections::HashSet<usize> =
            visited.iter().cloned().collect();
        assert_eq!(
            expected_set, visited_set,
            "node {} outgoing: expected {:?} but visited {:?}", node_slot, expected_set, visited_set
        );
    }

    // Verify incoming chains for all nodes
    for &node_slot in &state.node_slots {
        let node = h.node_chain.get_node(node_slot);
        let expected_in = incoming_by_node.get(&node_slot);
        let expected_count = expected_in.map_or(0, |v| v.len());

        if expected_count == 0 {
            assert_eq!(
                node.get_incoming_synapse_head(), 0,
                "node {} has no incoming synapses but head != 0", node_slot
            );
            assert_eq!(
                node.get_incoming_synapse_tail(), 0,
                "node {} has no incoming synapses but tail != 0", node_slot
            );
            continue;
        }

        let head = node.get_incoming_synapse_head();
        assert!(head > 0, "node {} has incoming synapses but head == 0", node_slot);

        let head_syn = h.synapse_chain.get_synapse(head);
        assert_eq!(
            head_syn.get_incoming_prev_ptr(), 0,
            "incoming head synapse {}'s prev must be 0", head
        );

        let mut visited = Vec::new();
        let mut current = head;
        let mut last = 0;
        let mut guard = 0;
        while current != 0 {
            visited.push(current);
            let syn = h.synapse_chain.get_synapse(current);

            // Verify target pointer
            assert_eq!(
                syn.get_target_ptr(), node_slot,
                "synapse {} target should be {} but is {}", current, node_slot, syn.get_target_ptr()
            );

            last = current;
            current = syn.get_incoming_next_ptr();

            if current != 0 {
                let next_syn = h.synapse_chain.get_synapse(current);
                assert_eq!(
                    next_syn.get_incoming_prev_ptr(), last,
                    "incoming backward link broken at synapse {}", current
                );
            }

            guard += 1;
            assert!(guard <= SYNAPSE_CAPACITY, "cycle in incoming chain of node {}", node_slot);
        }

        assert_eq!(
            node.get_incoming_synapse_tail(), last,
            "node {} incoming tail should be {} but is {}",
            node_slot, last, node.get_incoming_synapse_tail()
        );

        let expected_set: std::collections::HashSet<usize> =
            expected_in.unwrap().iter().cloned().collect();
        let visited_set: std::collections::HashSet<usize> =
            visited.iter().cloned().collect();
        assert_eq!(
            expected_set, visited_set,
            "node {} incoming: expected {:?} but visited {:?}", node_slot, expected_set, visited_set
        );
    }
}

// ============ Operations for property-based testing ============

#[derive(Debug, Clone)]
enum SynapseOp {
    AddNode,
    Connect(usize, usize), // indices into node_slots
    Disconnect(usize),      // index into synapse_edges
}

fn synapse_op_strategy() -> impl Strategy<Value = SynapseOp> {
    prop_oneof![
        2 => Just(SynapseOp::AddNode),
        4 => (0..32usize, 0..32usize).prop_map(|(a, b)| SynapseOp::Connect(a, b)),
        3 => (0..64usize).prop_map(SynapseOp::Disconnect),
    ]
}

proptest! {
    #[test]
    fn synapse_chain_random_ops_preserve_dual_linked_invariants(
        ops in proptest::collection::vec(synapse_op_strategy(), 1..150)
    ) {
        let h = setup();
        let mut state = GraphState::new();
        let mut kind_counter = 0i32;

        // Seed at least 2 nodes
        for i in 0..2 {
            if let Some(slot) = h.node_chain.insert_head_node(i) {
                state.node_slots.push(slot);
            }
        }

        for op in ops {
            match op {
                SynapseOp::AddNode => {
                    if state.node_slots.len() < NODE_CAPACITY {
                        kind_counter += 1;
                        if let Some(slot) = h.node_chain.insert_head_node(kind_counter) {
                            state.node_slots.push(slot);
                        }
                    }
                }
                SynapseOp::Connect(src_idx, tgt_idx) => {
                    if state.node_slots.len() >= 2
                        && state.synapse_edges.len() < SYNAPSE_CAPACITY
                    {
                        let src = state.node_slots[src_idx % state.node_slots.len()];
                        let tgt = state.node_slots[tgt_idx % state.node_slots.len()];
                        kind_counter += 1;
                        if let Some(syn_slot) = h.synapse_chain.connect(src, tgt, kind_counter) {
                            state.synapse_edges.push((syn_slot, src, tgt));
                        }
                    }
                }
                SynapseOp::Disconnect(idx) => {
                    if !state.synapse_edges.is_empty() {
                        let actual_idx = idx % state.synapse_edges.len();
                        let (syn_slot, _, _) = state.synapse_edges.remove(actual_idx);
                        let _ = h.synapse_chain.disconnect_synapse(syn_slot);
                    }
                }
            }

            // INVARIANT: all synapse chains are valid after every operation
            verify_synapse_integrity(&h, &state);
        }
    }

    #[test]
    fn synapse_chain_connect_disconnect_all_leaves_clean(
        edge_count in 1..30usize
    ) {
        let h = setup();
        let mut state = GraphState::new();

        // Create 4 nodes
        for i in 0..4 {
            let slot = h.node_chain.insert_head_node(i).unwrap();
            state.node_slots.push(slot);
        }

        // Connect edges
        for i in 0..edge_count {
            let src = state.node_slots[i % state.node_slots.len()];
            let tgt = state.node_slots[(i + 1) % state.node_slots.len()];
            if let Some(syn_slot) = h.synapse_chain.connect(src, tgt, i as i32) {
                state.synapse_edges.push((syn_slot, src, tgt));
            }
        }

        verify_synapse_integrity(&h, &state);

        // Disconnect all
        while let Some((syn_slot, _, _)) = state.synapse_edges.pop() {
            h.synapse_chain.disconnect_synapse(syn_slot).unwrap();
        }

        // All nodes should have clean synapse pointers
        for &node_slot in &state.node_slots {
            let node = h.node_chain.get_node(node_slot);
            prop_assert_eq!(node.get_outgoing_synapse_head(), 0);
            prop_assert_eq!(node.get_outgoing_synapse_tail(), 0);
            prop_assert_eq!(node.get_incoming_synapse_head(), 0);
            prop_assert_eq!(node.get_incoming_synapse_tail(), 0);
        }
    }

    #[test]
    fn synapse_chain_self_loops_work(
        count in 1..16usize
    ) {
        let h = setup();
        let mut state = GraphState::new();

        let node = h.node_chain.insert_head_node(1).unwrap();
        state.node_slots.push(node);

        // Create self-loops
        for i in 0..count {
            if let Some(syn_slot) = h.synapse_chain.connect(node, node, i as i32) {
                state.synapse_edges.push((syn_slot, node, node));
            }
        }

        verify_synapse_integrity(&h, &state);

        // Disconnect all self-loops
        while let Some((syn_slot, _, _)) = state.synapse_edges.pop() {
            h.synapse_chain.disconnect_synapse(syn_slot).unwrap();
        }

        let n = h.node_chain.get_node(node);
        prop_assert_eq!(n.get_outgoing_synapse_head(), 0);
        prop_assert_eq!(n.get_outgoing_synapse_tail(), 0);
        prop_assert_eq!(n.get_incoming_synapse_head(), 0);
        prop_assert_eq!(n.get_incoming_synapse_tail(), 0);
    }
}

// ============ Explicit edge cases ============

#[test]
fn disconnect_middle_of_outgoing_chain() {
    let h = setup();

    let a = h.node_chain.insert_head_node(1).unwrap();
    let b = h.node_chain.insert_head_node(2).unwrap();

    let s1 = h.synapse_chain.connect(a, b, 10).unwrap();
    let s2 = h.synapse_chain.connect(a, b, 20).unwrap();
    let s3 = h.synapse_chain.connect(a, b, 30).unwrap();

    // Disconnect middle
    h.synapse_chain.disconnect_synapse(s2).unwrap();

    // Chain: s1 -> s3
    let syn1 = h.synapse_chain.get_synapse(s1);
    let syn3 = h.synapse_chain.get_synapse(s3);

    assert_eq!(syn1.get_outgoing_next_ptr(), s3);
    assert_eq!(syn3.get_outgoing_prev_ptr(), s1);
    assert_eq!(syn1.get_outgoing_prev_ptr(), 0);
    assert_eq!(syn3.get_outgoing_next_ptr(), 0);

    let node_a = h.node_chain.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), s1);
    assert_eq!(node_a.get_outgoing_synapse_tail(), s3);
}

#[test]
fn disconnect_head_of_incoming_chain() {
    let h = setup();

    let a = h.node_chain.insert_head_node(1).unwrap();
    let b = h.node_chain.insert_head_node(2).unwrap();
    let c = h.node_chain.insert_head_node(3).unwrap();

    // All point to b
    let s1 = h.synapse_chain.connect(a, b, 10).unwrap();
    let s2 = h.synapse_chain.connect(c, b, 20).unwrap();

    // Disconnect head of b's incoming chain
    h.synapse_chain.disconnect_synapse(s1).unwrap();

    let node_b = h.node_chain.get_node(b);
    assert_eq!(node_b.get_incoming_synapse_head(), s2);
    assert_eq!(node_b.get_incoming_synapse_tail(), s2);

    let syn2 = h.synapse_chain.get_synapse(s2);
    assert_eq!(syn2.get_incoming_prev_ptr(), 0);
    assert_eq!(syn2.get_incoming_next_ptr(), 0);
}

#[test]
fn fan_out_and_fan_in_topology() {
    let h = setup();
    let mut state = GraphState::new();

    let hub = h.node_chain.insert_head_node(0).unwrap();
    state.node_slots.push(hub);

    // Create 8 spoke nodes
    let mut spokes = Vec::new();
    for i in 1..=8 {
        let s = h.node_chain.insert_head_node(i).unwrap();
        state.node_slots.push(s);
        spokes.push(s);
    }

    // Fan-out: hub -> all spokes
    for &spoke in &spokes {
        let syn = h.synapse_chain.connect(hub, spoke, 1).unwrap();
        state.synapse_edges.push((syn, hub, spoke));
    }

    // Fan-in: all spokes -> hub
    for &spoke in &spokes {
        let syn = h.synapse_chain.connect(spoke, hub, 2).unwrap();
        state.synapse_edges.push((syn, spoke, hub));
    }

    verify_synapse_integrity(&h, &state);

    // Disconnect all fan-out
    let fan_out_syns: Vec<_> = state.synapse_edges.iter()
        .filter(|&&(_, src, _)| src == hub)
        .map(|&(s, _, _)| s)
        .collect();
    for syn in fan_out_syns {
        h.synapse_chain.disconnect_synapse(syn).unwrap();
        state.synapse_edges.retain(|&(s, _, _)| s != syn);
    }

    verify_synapse_integrity(&h, &state);

    // Hub should have no outgoing but still have incoming
    let hub_node = h.node_chain.get_node(hub);
    assert_eq!(hub_node.get_outgoing_synapse_head(), 0);
    assert_eq!(hub_node.get_outgoing_synapse_tail(), 0);
    assert!(hub_node.get_incoming_synapse_head() > 0);
}
