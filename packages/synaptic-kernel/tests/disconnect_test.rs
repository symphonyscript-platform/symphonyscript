use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config(capacity: usize) -> KernelConfig {
    KernelConfig {
        node_capacity: capacity,
        synapse_capacity: capacity,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

// =========================================================
// disconnect(source, target) — single synapse
// =========================================================

#[test]
fn disconnect_by_endpoints_removes_single_synapse() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    kernel.connect(a, b, 1).unwrap();
    assert_eq!(kernel.synapse_count(), 1);

    kernel.disconnect(a, b).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), 0);
    assert_eq!(node_a.get_outgoing_synapse_tail(), 0);

    let node_b = kernel.get_node(b);
    assert_eq!(node_b.get_incoming_synapse_head(), 0);
    assert_eq!(node_b.get_incoming_synapse_tail(), 0);
}

// =========================================================
// disconnect(source, target) — multiple synapses same pair
// =========================================================

#[test]
fn disconnect_by_endpoints_removes_all_synapses_between_pair() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    kernel.connect(a, b, 1).unwrap();
    kernel.connect(a, b, 2).unwrap();
    kernel.connect(a, b, 3).unwrap();
    assert_eq!(kernel.synapse_count(), 3);

    kernel.disconnect(a, b).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), 0);
    assert_eq!(node_a.get_outgoing_synapse_tail(), 0);

    let node_b = kernel.get_node(b);
    assert_eq!(node_b.get_incoming_synapse_head(), 0);
    assert_eq!(node_b.get_incoming_synapse_tail(), 0);
}

// =========================================================
// disconnect(source, target) — preserves unrelated synapses
// =========================================================

#[test]
fn disconnect_by_endpoints_preserves_other_targets() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();
    let c = kernel.insert_node_after(b, 3).unwrap();

    let _s_ab = kernel.connect(a, b, 1).unwrap();
    let s_ac = kernel.connect(a, c, 2).unwrap();

    kernel.disconnect(a, b).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), s_ac);
    assert_eq!(node_a.get_outgoing_synapse_tail(), s_ac);

    assert_eq!(kernel.get_synapse(s_ac).get_kind(), 2);
    assert_eq!(kernel.get_synapse(s_ac).get_target_ptr(), c);
}

#[test]
fn disconnect_by_endpoints_preserves_other_sources() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();
    let c = kernel.insert_node_after(b, 3).unwrap();

    let _s_ab = kernel.connect(a, b, 1).unwrap();
    let s_cb = kernel.connect(c, b, 2).unwrap();

    kernel.disconnect(a, b).unwrap();

    let node_b = kernel.get_node(b);
    assert_eq!(node_b.get_incoming_synapse_head(), s_cb);
    assert_eq!(node_b.get_incoming_synapse_tail(), s_cb);
}

// =========================================================
// disconnect(source, target) — no-op when no connection
// =========================================================

#[test]
fn disconnect_by_endpoints_noop_when_not_connected() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    kernel.disconnect(a, b).unwrap();
}

// =========================================================
// disconnect(source, target) — direction matters
// =========================================================

#[test]
fn disconnect_by_endpoints_is_directional() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    let s_ab = kernel.connect(a, b, 1).unwrap();

    kernel.disconnect(b, a).unwrap();

    assert_eq!(kernel.get_node(a).get_outgoing_synapse_head(), s_ab);
    assert_eq!(kernel.get_node(b).get_incoming_synapse_head(), s_ab);
}

// =========================================================
// disconnect(source, target) — mixed with disconnect_synapse
// =========================================================

#[test]
fn disconnect_by_endpoints_after_surgical_disconnect() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    let s1 = kernel.connect(a, b, 1).unwrap();
    let _s2 = kernel.connect(a, b, 2).unwrap();
    let _s3 = kernel.connect(a, b, 3).unwrap();

    kernel.disconnect_synapse(s1).unwrap();
    kernel.disconnect(a, b).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), 0);
    assert_eq!(node_a.get_outgoing_synapse_tail(), 0);
}

// =========================================================
// multigraph — multiple edges between same pair
// =========================================================

#[test]
fn multigraph_allows_duplicate_edges() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    let s1 = kernel.connect(a, b, 1).unwrap();
    let s2 = kernel.connect(a, b, 2).unwrap();

    assert_ne!(s1, s2);
    assert_eq!(kernel.synapse_count(), 2);
    assert_eq!(kernel.get_synapse(s1).get_kind(), 1);
    assert_eq!(kernel.get_synapse(s2).get_kind(), 2);
    assert_eq!(kernel.get_synapse(s1).get_source_ptr(), a);
    assert_eq!(kernel.get_synapse(s2).get_source_ptr(), a);
    assert_eq!(kernel.get_synapse(s1).get_target_ptr(), b);
    assert_eq!(kernel.get_synapse(s2).get_target_ptr(), b);
}

#[test]
fn multigraph_surgical_disconnect_preserves_sibling() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    let s1 = kernel.connect(a, b, 1).unwrap();
    let s2 = kernel.connect(a, b, 2).unwrap();

    kernel.disconnect_synapse(s1).unwrap();

    assert_eq!(kernel.get_node(a).get_outgoing_synapse_head(), s2);
    assert_eq!(kernel.get_node(a).get_outgoing_synapse_tail(), s2);
    assert_eq!(kernel.get_node(b).get_incoming_synapse_head(), s2);
    assert_eq!(kernel.get_node(b).get_incoming_synapse_tail(), s2);
    assert_eq!(kernel.get_synapse(s2).get_kind(), 2);
}

// =========================================================
// disconnect(source, target) — self-loops
// =========================================================

#[test]
fn disconnect_by_endpoints_removes_self_loop() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();

    kernel.connect(a, a, 1).unwrap();
    kernel.disconnect(a, a).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), 0);
    assert_eq!(node_a.get_outgoing_synapse_tail(), 0);
    assert_eq!(node_a.get_incoming_synapse_head(), 0);
    assert_eq!(node_a.get_incoming_synapse_tail(), 0);
}

#[test]
fn disconnect_by_endpoints_removes_multiple_self_loops() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();

    kernel.connect(a, a, 1).unwrap();
    kernel.connect(a, a, 2).unwrap();

    kernel.disconnect(a, a).unwrap();

    let node_a = kernel.get_node(a);
    assert_eq!(node_a.get_outgoing_synapse_head(), 0);
    assert_eq!(node_a.get_outgoing_synapse_tail(), 0);
    assert_eq!(node_a.get_incoming_synapse_head(), 0);
    assert_eq!(node_a.get_incoming_synapse_tail(), 0);
}

// =========================================================
// disconnect(source, target) — complex topology
// =========================================================

#[test]
fn disconnect_in_triangle_preserves_remaining_edges() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();
    let c = kernel.insert_node_after(b, 3).unwrap();

    let _s_ab = kernel.connect(a, b, 10).unwrap();
    let s_ac = kernel.connect(a, c, 20).unwrap();
    let s_bc = kernel.connect(b, c, 30).unwrap();

    kernel.disconnect(a, b).unwrap();

    assert_eq!(kernel.get_node(a).get_outgoing_synapse_head(), s_ac);
    assert_eq!(kernel.get_node(a).get_outgoing_synapse_tail(), s_ac);

    assert_eq!(kernel.get_node(b).get_incoming_synapse_head(), 0);
    assert_eq!(kernel.get_node(b).get_outgoing_synapse_head(), s_bc);

    assert_eq!(kernel.get_node(c).get_incoming_synapse_head(), s_ac);
    assert_eq!(kernel.get_node(c).get_incoming_synapse_tail(), s_bc);
}

#[test]
fn disconnect_all_edges_in_fully_connected_triangle() {
    let kernel = TestKernel::new(config(16));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();
    let c = kernel.insert_node_after(b, 3).unwrap();

    kernel.connect(a, b, 1).unwrap();
    kernel.connect(a, c, 2).unwrap();
    kernel.connect(b, c, 3).unwrap();

    kernel.disconnect(a, b).unwrap();
    kernel.disconnect(a, c).unwrap();
    kernel.disconnect(b, c).unwrap();

    for &node in &[a, b, c] {
        let n = kernel.get_node(node);
        assert_eq!(n.get_outgoing_synapse_head(), 0);
        assert_eq!(n.get_outgoing_synapse_tail(), 0);
        assert_eq!(n.get_incoming_synapse_head(), 0);
        assert_eq!(n.get_incoming_synapse_tail(), 0);
    }
}

// =========================================================
// disconnect(source, target) — interleaved with connect
// =========================================================

#[test]
fn disconnect_then_reconnect_same_pair() {
    let mut kernel = TestKernel::new(config(4));
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    let s1 = kernel.connect(a, b, 1).unwrap();
    kernel.disconnect(a, b).unwrap();

    kernel.publish();
    let cp = kernel.get_control_plane();
    let mut consumer = EpochConsumer::new(cp);
    let _graph = consumer.acquire_mirror();
    kernel.publish();

    let s2 = kernel.connect(a, b, 2).unwrap();
    assert_eq!(s2, s1, "freed slot reused");
    assert_eq!(kernel.get_synapse(s2).get_kind(), 2);
}

// =========================================================
// disconnect_synapse vs disconnect — API parity
// =========================================================

#[test]
fn disconnect_synapse_and_disconnect_produce_same_result() {
    let kernel_a = TestKernel::new(config(16));
    let a1 = kernel_a.insert_head_node(1).unwrap();
    let b1 = kernel_a.insert_node_after(a1, 2).unwrap();
    kernel_a.connect(a1, b1, 10).unwrap();
    kernel_a.disconnect(a1, b1).unwrap();

    let kernel_b = TestKernel::new(config(16));
    let a2 = kernel_b.insert_head_node(1).unwrap();
    let b2 = kernel_b.insert_node_after(a2, 2).unwrap();
    let s = kernel_b.connect(a2, b2, 10).unwrap();
    kernel_b.disconnect_synapse(s).unwrap();

    for &(k, a, b) in &[(&kernel_a, a1, b1), (&kernel_b, a2, b2)] {
        let na = k.get_node(a);
        let nb = k.get_node(b);
        assert_eq!(na.get_outgoing_synapse_head(), 0);
        assert_eq!(na.get_outgoing_synapse_tail(), 0);
        assert_eq!(nb.get_incoming_synapse_head(), 0);
        assert_eq!(nb.get_incoming_synapse_tail(), 0);
    }
}
