use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::epoch::Epoch;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;
use synaptic_kernel::primitives::types::AtomicBuffer;

const NODE_META: usize = 4;
const NODE_ATTR: usize = 8;
const SYNAPSE_META: usize = 4;
const SYNAPSE_ATTR: usize = 8;

type TestEpoch = Epoch<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
type TestKernel = Kernel<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn make_mem(size: usize) -> AtomicBuffer {
    let mut v = Vec::with_capacity(size);
    for _ in 0..size {
        v.push(AtomicI32::new(0));
    }
    Arc::new(v)
}

fn mk_config(
    node_capacity: usize,
    synapse_capacity: usize,
    mem_metadata_size: usize,
    tb_metadata_size: usize,
) -> KernelConfig {
    KernelConfig {
        node_capacity,
        synapse_capacity,
        mem_metadata_size,
        tb_metadata_size,
    }
}

// ============ Section 1 — Construction & lifecycle ============

#[test]
fn new_on_fresh_mem_with_exact_size_succeeds() {
    let config = mk_config(4, 4, 1, 1);
    let size = TestEpoch::calculate_size_on_mem(&config);
    let mem = make_mem(size);
    let _epoch = TestEpoch::new(mem, config, 0);
}

#[test]
fn new_then_bind_on_same_mem_sees_same_capacities() {
    // `Epoch::new` initialises the memory region; `Epoch::bind` should then
    // attach to that already-initialised region and expose the same
    // config-derived state.
    let config = mk_config(8, 8, 2, 2);
    let size = TestEpoch::calculate_size_on_mem(&config);
    let mem = make_mem(size);

    {
        let _writer = TestEpoch::new(Arc::clone(&mem), config.clone(), 0);
        // Writer dropped; state persists in shared AtomicBuffer.
    }

    let bound = TestEpoch::bind(Arc::clone(&mem), config.clone(), 0);
    let mirror = bound.to_mirror();

    assert_eq!(mirror.mem_metadata_capacity(), config.mem_metadata_size);
    assert_eq!(mirror.tb_metadata_capacity(), config.tb_metadata_size);
    // Fresh, nothing published: no head node.
    assert!(mirror.get_head_node().is_none());
}

#[test]
fn bind_preserves_topology_written_by_new_through_kernel_driver() {
    // Kernel::new internally performs Epoch::new at offset HEADERS_SIZE.
    // Bind a separate Epoch at the same offset and verify it observes the
    // writer's topology via a bound mirror.
    let config = mk_config(8, 8, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let slot = kernel.insert_head_node(42).unwrap();

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());

    let head = mirror.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 42);
    // slot numbering is 1-based.
    assert!(slot > 0);
}

#[test]
fn calculate_size_on_mem_matches_footprint_4_4_1_1() {
    let config = mk_config(4, 4, 1, 1);
    let size = TestEpoch::calculate_size_on_mem(&config);
    assert!(size > 0);
    let mem = make_mem(size);
    // Must succeed with exactly the declared size.
    let _epoch = TestEpoch::new(mem, config, 0);
}

#[test]
fn calculate_size_on_mem_matches_footprint_16_32_4_4() {
    let config = mk_config(16, 32, 4, 4);
    let size = TestEpoch::calculate_size_on_mem(&config);
    let mem = make_mem(size);
    let _epoch = TestEpoch::new(mem, config, 0);
}

#[test]
fn calculate_size_on_mem_matches_footprint_128_256_16_8() {
    let config = mk_config(128, 256, 16, 8);
    let size = TestEpoch::calculate_size_on_mem(&config);
    let mem = make_mem(size);
    let _epoch = TestEpoch::new(mem, config, 0);
}

#[test]
fn calculate_size_on_mem_matches_footprint_1_1_1_1() {
    // Edge: minimum viable config (still power-of-2 for metadata sizes).
    let config = mk_config(1, 1, 1, 1);
    let size = TestEpoch::calculate_size_on_mem(&config);
    let mem = make_mem(size);
    let _epoch = TestEpoch::new(mem, config, 0);
}

#[test]
fn calculate_size_on_mem_grows_monotonically_with_capacity() {
    let s_small = TestEpoch::calculate_size_on_mem(&mk_config(4, 4, 1, 1));
    let s_mid = TestEpoch::calculate_size_on_mem(&mk_config(16, 32, 4, 4));
    let s_big = TestEpoch::calculate_size_on_mem(&mk_config(128, 256, 16, 8));
    assert!(s_small < s_mid);
    assert!(s_mid < s_big);
}

#[test]
fn calculate_size_on_tb_grows_monotonically_with_capacity() {
    let t_small = TestEpoch::calculate_size_on_tb(&mk_config(4, 4, 1, 1));
    let t_mid = TestEpoch::calculate_size_on_tb(&mk_config(16, 32, 4, 4));
    let t_big = TestEpoch::calculate_size_on_tb(&mk_config(128, 256, 16, 8));
    assert!(t_small < t_mid);
    assert!(t_mid < t_big);
}

#[test]
fn new_at_nonzero_offset_works() {
    // Kernel uses offset HEADERS_SIZE = 2 when handing memory to Epoch.
    // Verify Epoch is offset-agnostic beyond needing the mem region to fit.
    let config = mk_config(4, 4, 1, 1);
    let offset = 7usize;
    let size = TestEpoch::calculate_size_on_mem(&config) + offset;
    let mem = make_mem(size);
    let _epoch = TestEpoch::new(mem, config, offset);
}

#[cfg(debug_assertions)]
#[test]
#[should_panic]
fn new_with_undersized_mem_debug_panics() {
    // Memory too small to fit even the TripleBufferWriter header: an
    // internal debug_assert inside one of the writer components must fire.
    let config = mk_config(4, 4, 1, 1);
    let size = TestEpoch::calculate_size_on_mem(&config);
    // Halve the size — well below what any viable layout needs.
    let mem = make_mem(size / 2);
    let _epoch = TestEpoch::new(mem, config, 0);
}

// ============ Section 2 — to_mirror round-trip ============

#[test]
fn mirror_sees_inserted_node_after_publish_swap() {
    let config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let slot = kernel.insert_head_node(5).unwrap();
    kernel.get_node(slot).attr_write(0, 4242);
    kernel.get_node(slot).set_meta(0, 99);

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());

    let head = mirror.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 5);
    assert_eq!(head.attr_read(0), 4242);
    assert_eq!(head.get_meta(0), 99);
}

#[test]
fn mirror_sees_connected_synapse_after_publish_swap() {
    let config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_head_node(2).unwrap();
    let s = kernel.connect(a, b, 7).unwrap();
    kernel.get_synapse(s).attr_write(0, 111);
    kernel.get_synapse(s).set_meta(0, 222);

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());

    let syn = mirror.get_synapse(s);
    assert_eq!(syn.get_kind(), 7);
    assert_eq!(syn.get_source_ptr(), a);
    assert_eq!(syn.get_target_ptr(), b);
    assert_eq!(syn.attr_read(0), 111);
    assert_eq!(syn.get_meta(0), 222);
}

// ============ Section 3 — publish ordering / plane consistency ============

#[test]
fn attr_is_visible_without_publish_but_meta_requires_publish() {
    let config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let slot = kernel.insert_head_node(1).unwrap();

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());
    // Baseline: node exists, default meta is 0.
    assert_eq!(mirror.get_node(slot).get_meta(0), 0);

    // attr lives on the MEM plane — direct visibility without publish.
    kernel.get_node(slot).attr_write(0, 1234);
    assert_eq!(mirror.get_node(slot).attr_read(0), 1234);

    // meta lives on the TB plane — writes go to the writer buffer only.
    kernel.get_node(slot).set_meta(0, 777);
    // mirror still holds the previous published buffer → must NOT see it.
    assert_eq!(mirror.get_node(slot).get_meta(0), 0);

    // After publish + swap, mirror picks up the new buffer and sees meta.
    bound.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_node(slot).get_meta(0), 777);
}

#[test]
fn synapse_attr_visible_without_publish_synapse_meta_requires_publish() {
    let config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_head_node(2).unwrap();
    let s = kernel.connect(a, b, 3).unwrap();

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());
    assert_eq!(mirror.get_synapse(s).get_meta(0), 0);

    kernel.get_synapse(s).attr_write(0, 55);
    assert_eq!(mirror.get_synapse(s).attr_read(0), 55);

    kernel.get_synapse(s).set_meta(0, 66);
    assert_eq!(mirror.get_synapse(s).get_meta(0), 0);

    bound.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_synapse(s).get_meta(0), 66);
}

// ============ Section 4 — copy_from migration ============

#[test]
fn copy_from_migrates_chain_synapses_and_metadata_to_larger() {
    let src_config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(src_config.clone());

    let n1 = kernel.insert_head_node(10).unwrap();
    let n2 = kernel.insert_node_after(n1, 20).unwrap();
    let n3 = kernel.insert_node_after(n2, 30).unwrap();

    let s12 = kernel.connect(n1, n2, 40).unwrap();
    let s23 = kernel.connect(n2, n3, 50).unwrap();

    kernel.get_node(n1).attr_write(0, 1001);
    kernel.get_node(n2).attr_write(0, 2002);
    kernel.get_node(n3).attr_write(0, 3003);
    kernel.get_node(n1).set_meta(0, 100);
    kernel.get_node(n2).set_meta(0, 200);
    kernel.get_node(n3).set_meta(0, 300);

    kernel.get_synapse(s12).attr_write(0, 4000);
    kernel.get_synapse(s23).attr_write(0, 5000);
    kernel.get_synapse(s12).set_meta(0, 400);
    kernel.get_synapse(s23).set_meta(0, 500);

    kernel.mem_write_meta(0, 9999);
    kernel.tb_write_meta(0, 8888);

    let source = TestEpoch::bind(kernel.get_mem(), src_config, TestKernel::HEADERS_SIZE);

    let dst_config = mk_config(8, 8, 1, 1);
    let dst_mem = make_mem(TestEpoch::calculate_size_on_mem(&dst_config));
    let dst = TestEpoch::new(dst_mem, dst_config, 0);

    dst.copy_from(&source);
    dst.publish();
    let mirror = dst.to_mirror();
    assert!(mirror.swap());

    // Node chain n1 -> n2 -> n3.
    let head = mirror.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 10);
    assert_eq!(head.attr_read(0), 1001);
    assert_eq!(head.get_meta(0), 100);

    let mid = mirror.get_node(head.get_next_ptr());
    assert_eq!(mid.get_kind(), 20);
    assert_eq!(mid.attr_read(0), 2002);
    assert_eq!(mid.get_meta(0), 200);

    let tail = mirror.get_node(mid.get_next_ptr());
    assert_eq!(tail.get_kind(), 30);
    assert_eq!(tail.attr_read(0), 3003);
    assert_eq!(tail.get_meta(0), 300);
    assert_eq!(tail.get_next_ptr(), 0);

    // Synapses via source node's outgoing chain.
    assert_eq!(head.get_outgoing_synapse_head(), s12);
    let syn12 = mirror.get_synapse(s12);
    assert_eq!(syn12.get_kind(), 40);
    assert_eq!(syn12.get_source_ptr(), n1);
    assert_eq!(syn12.get_target_ptr(), n2);
    assert_eq!(syn12.attr_read(0), 4000);
    assert_eq!(syn12.get_meta(0), 400);

    assert_eq!(mid.get_outgoing_synapse_head(), s23);
    let syn23 = mirror.get_synapse(s23);
    assert_eq!(syn23.get_kind(), 50);
    assert_eq!(syn23.get_source_ptr(), n2);
    assert_eq!(syn23.get_target_ptr(), n3);
    assert_eq!(syn23.attr_read(0), 5000);
    assert_eq!(syn23.get_meta(0), 500);

    // Metadata.
    assert_eq!(mirror.mem_read_meta(0), 9999);
    assert_eq!(mirror.tb_read_meta(0), 8888);
}

#[test]
fn copy_from_with_equal_capacities() {
    let config = mk_config(4, 4, 1, 1);
    let kernel = TestKernel::new(config.clone());
    let n = kernel.insert_head_node(1).unwrap();
    kernel.get_node(n).attr_write(0, 42);
    kernel.get_node(n).set_meta(0, 7);

    let source = TestEpoch::bind(kernel.get_mem(), config.clone(), TestKernel::HEADERS_SIZE);
    let dst_mem = make_mem(TestEpoch::calculate_size_on_mem(&config));
    let dst = TestEpoch::new(dst_mem, config, 0);

    dst.copy_from(&source);
    dst.publish();
    let mirror = dst.to_mirror();
    assert!(mirror.swap());

    let head = mirror.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.attr_read(0), 42);
    assert_eq!(head.get_meta(0), 7);
}

#[test]
fn copy_from_with_holes_preserves_chain_only() {
    // Fragmented source: some interior slots freed. Destination must see
    // only the surviving chain, and arbitrary freed slot data must not
    // corrupt the chain traversal.
    let config = mk_config(8, 8, 1, 1);
    let mut kernel = TestKernel::new(config.clone());

    let n1 = kernel.insert_head_node(1).unwrap();
    let n2 = kernel.insert_node_after(n1, 2).unwrap();
    let n3 = kernel.insert_node_after(n2, 3).unwrap();
    let n4 = kernel.insert_node_after(n3, 4).unwrap();

    kernel.remove_node(n2).unwrap();
    kernel.remove_node(n3).unwrap();
    kernel.publish(); // flush deferred frees through the generational gate

    let source = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    let bigger = mk_config(16, 16, 1, 1);
    let dst_mem = make_mem(TestEpoch::calculate_size_on_mem(&bigger));
    let dst = TestEpoch::new(dst_mem, bigger, 0);

    dst.copy_from(&source);
    dst.publish();
    let mirror = dst.to_mirror();
    assert!(mirror.swap());

    let head = mirror.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    let next = mirror.get_node(head.get_next_ptr());
    assert_eq!(next.get_kind(), 4);
    assert_eq!(next.get_next_ptr(), 0);

    // Surviving slots preserve their original ids.
    assert!(n1 != n4);
    let n1_view = mirror.get_node(n1);
    let n4_view = mirror.get_node(n4);
    assert_eq!(n1_view.get_kind(), 1);
    assert_eq!(n4_view.get_kind(), 4);
}

// ============ Section 5 — publish with multiple rotations ============

#[test]
fn mirror_sees_latest_state_after_10_publish_cycles() {
    let config = mk_config(16, 16, 1, 1);
    let kernel = TestKernel::new(config.clone());

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    let mirror = bound.to_mirror();

    for i in 0..10 {
        let slot = kernel.insert_head_node(i).unwrap();
        kernel.get_node(slot).set_meta(0, 1000 + i as i32);

        bound.publish();
        assert!(mirror.swap(), "cycle {}: swap must return true after publish", i);

        let head = mirror.get_head_node().unwrap();
        assert_eq!(head.get_kind(), i, "cycle {}: head kind", i);
        assert_eq!(head.get_meta(0), 1000 + i as i32, "cycle {}: head meta", i);
    }
}

#[test]
fn mirror_without_swap_retains_prior_snapshot_across_publishes() {
    let config = mk_config(8, 8, 1, 1);
    let kernel = TestKernel::new(config.clone());

    let bound = TestEpoch::bind(kernel.get_mem(), config, TestKernel::HEADERS_SIZE);
    let mirror = bound.to_mirror();

    let a = kernel.insert_head_node(1).unwrap();
    kernel.get_node(a).set_meta(0, 11);
    bound.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_head_node().unwrap().get_kind(), 1);
    assert_eq!(mirror.get_node(a).get_meta(0), 11);

    // Second cycle: mutate + publish but do NOT swap.
    let _b = kernel.insert_head_node(2).unwrap();
    kernel.get_node(a).set_meta(0, 22);
    bound.publish();

    // Mirror still holds state from cycle 1.
    assert_eq!(mirror.get_head_node().unwrap().get_kind(), 1);
    assert_eq!(mirror.get_node(a).get_meta(0), 11);

    // Only after swap does the new state appear.
    assert!(mirror.swap());
    assert_eq!(mirror.get_head_node().unwrap().get_kind(), 2);
    assert_eq!(mirror.get_node(a).get_meta(0), 22);
}

// ============ Section 6 — debug-assert panic coverage ============

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "cannot be greater than destination")]
fn copy_from_panics_when_source_node_capacity_exceeds_destination() {
    let src_config = mk_config(8, 8, 1, 1);
    let src_mem = make_mem(TestEpoch::calculate_size_on_mem(&src_config));
    let src = TestEpoch::new(src_mem, src_config, 0);

    let dst_config = mk_config(4, 4, 1, 1);
    let dst_mem = make_mem(TestEpoch::calculate_size_on_mem(&dst_config));
    let dst = TestEpoch::new(dst_mem, dst_config, 0);

    dst.copy_from(&src);
}

// ============ Section 7 — const-generic stride variations ============

#[test]
fn epoch_works_with_zero_user_zones() {
    // Zero strides: no meta or attr slots for nodes/synapses.
    type EpochZero = Epoch<0, 0, 0, 0>;
    type KernelZero = Kernel<0, 0, 0, 0>;

    let config = mk_config(4, 4, 1, 1);
    let kernel = KernelZero::new(config.clone());
    let slot = kernel.insert_head_node(7).unwrap();
    assert!(slot > 0);

    let bound = EpochZero::bind(kernel.get_mem(), config, KernelZero::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());
    assert_eq!(mirror.get_head_node().unwrap().get_kind(), 7);
}

#[test]
fn epoch_works_with_minimal_strides() {
    type EpochMin = Epoch<1, 1, 1, 1>;
    type KernelMin = Kernel<1, 1, 1, 1>;

    let config = mk_config(4, 4, 1, 1);
    let kernel = KernelMin::new(config.clone());
    let a = kernel.insert_head_node(3).unwrap();
    let b = kernel.insert_head_node(4).unwrap();
    let s = kernel.connect(a, b, 5).unwrap();

    kernel.get_node(a).attr_write(0, 99);
    kernel.get_node(a).set_meta(0, 88);
    kernel.get_synapse(s).attr_write(0, 77);
    kernel.get_synapse(s).set_meta(0, 66);

    let bound = EpochMin::bind(kernel.get_mem(), config, KernelMin::HEADERS_SIZE);
    bound.publish();
    let mirror = bound.to_mirror();
    assert!(mirror.swap());

    let head = mirror.get_head_node().unwrap();
    // head is the most recent insert (b, kind=4).
    assert_eq!(head.get_kind(), 4);

    let a_view = mirror.get_node(a);
    assert_eq!(a_view.get_kind(), 3);
    assert_eq!(a_view.attr_read(0), 99);
    assert_eq!(a_view.get_meta(0), 88);

    let syn = mirror.get_synapse(s);
    assert_eq!(syn.get_kind(), 5);
    assert_eq!(syn.attr_read(0), 77);
    assert_eq!(syn.get_meta(0), 66);
}
