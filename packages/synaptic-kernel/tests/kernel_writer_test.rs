mod common;

use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<1, 1>;
type TestConsumer = EpochConsumer<1, 1>;

fn config() -> KernelConfig<1, 1> {
    common::kernel_config_1_1(16, 32, NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR)
}

fn create_writer() -> TestKernel {
    TestKernel::new(config())
}

fn insert_head_with_tick(kernel: &TestKernel, kind: i32, tick: i32) -> usize {
    let slot = kernel.insert_head_node(kind).unwrap();
    // Tick lives on the TB (meta) plane: `kind` via `insert_head_node`,
    // `tick` via `set_meta`. Matches the original semantics.
    kernel.get_node(slot).set_meta(0, tick);
    slot
}

// ============ Construction ============

#[test]
fn kernel_new_creates_empty_chain() {
    let mut kernel = create_writer();
    assert!(kernel.get_head_node().is_none());
}

// ============ Node insertion ============

#[test]
fn insert_head_returns_slot() {
    let mut kernel = create_writer();
    let slot = kernel.insert_head_node(1);
    assert!(slot.is_ok());
    assert!(slot.unwrap() > 0);
}

#[test]
fn insert_head_writes_kind_and_tick() {
    let mut kernel = create_writer();
    let slot = insert_head_with_tick(&kernel, 5, 999);

    let node = kernel.get_node(slot);
    assert_eq!(node.get_kind(), 5);
    // `insert_head_with_tick` writes tick via `set_meta(0, ...)` on the TB
    // plane; read it back from the same plane.
    assert_eq!(node.get_meta(0), 999);
}

#[test]
fn insert_head_chain_ordering() {
    let mut kernel = create_writer();

    let a = insert_head_with_tick(&kernel, 1, 10);
    let b = insert_head_with_tick(&kernel, 2, 20);
    let _c = insert_head_with_tick(&kernel, 3, 30);

    // chain: c -> b -> a
    let head = kernel.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 3);
    assert_eq!(head.get_next_ptr(), b);

    assert_eq!(kernel.get_node(b).get_next_ptr(), a);
    assert_eq!(kernel.get_node(a).get_next_ptr(), 0);
}

#[test]
fn insert_after_splices_correctly() {
    let mut kernel = create_writer();

    let a = kernel.insert_head_node(1).unwrap();
    let c = kernel.insert_node_after(a, 3).unwrap();
    let b = kernel.insert_node_after(a, 2).unwrap();

    // chain: a -> b -> c (head is a since insert_head only called once)
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_next_ptr(), 0);
}

#[test]
fn insert_before_splices_correctly() {
    let mut kernel = create_writer();

    let a = kernel.insert_head_node(1).unwrap();
    let c = kernel.insert_node_after(a, 3).unwrap();
    let b = kernel.insert_node_before(c, 2).unwrap();

    // a -> b -> c
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_prev_ptr(), b);
}

#[test]
fn insert_exhausts_capacity() {
    let mut kernel = create_writer();

    for i in 0..16 {
        assert!(kernel.insert_head_node(i).is_ok());
    }
    assert!(kernel.insert_head_node(99).is_err());
}

// ============ Node removal + deferred frees ============

#[test]
fn remove_node_heals_chain() {
    let mut kernel = create_writer();

    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_head_node(2).unwrap();
    let c = kernel.insert_head_node(3).unwrap();
    // chain: c -> b -> a

    kernel.remove_node(b).unwrap();
    // chain: c -> a

    assert_eq!(kernel.get_node(c).get_next_ptr(), a);
    assert_eq!(kernel.get_node(a).get_prev_ptr(), c);
}

#[test]
fn remove_then_publish_reclaims_slot() {
    let mut kernel = create_writer();

    // fill all slots
    let mut slots = Vec::new();
    for i in 0..16 {
        slots.push(kernel.insert_head_node(i).unwrap());
    }
    assert!(kernel.insert_head_node(99).is_err(), "capacity full");

    // remove one
    kernel.remove_node(slots[0]).unwrap();

    // slot not yet reclaimed (deferred)
    assert!(kernel.insert_head_node(99).is_err(), "still deferred");

    // publish #1: shift to previous list
    kernel.publish();

    // explicitly acknowledge the generation boundary
    TestConsumer::new(kernel.get_control_plane()).acquire_mirror();

    // publish #2: drains the previous list
    kernel.publish();

    // now the slot is available
    let reclaimed = kernel.insert_head_node(99);
    assert!(reclaimed.is_ok(), "slot reclaimed after publish");
}

/* fn double_remove_returns_error() {
    let kernel = Kernel::new(config());
    let a = kernel.insert_head_node(1).unwrap();
    kernel.remove_node(a).unwrap();
    /* commented err check */
} */
// ============ Synapse connect/disconnect ============
#[test]
fn connect_creates_synapse() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();

    let syn = kernel.connect(src, tgt, 10).unwrap();

    let s = kernel.get_synapse(syn);
    assert_eq!(s.get_kind(), 10);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
}

#[test]
fn connect_updates_node_synapse_pointers() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    assert_eq!(kernel.get_node(src).get_outgoing_synapse_head(), syn);
    assert_eq!(kernel.get_node(src).get_outgoing_synapse_tail(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_head(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_tail(), syn);
}

#[test]
fn disconnect_heals_synapse_chain() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt1 = kernel.insert_head_node(2).unwrap();
    let tgt2 = kernel.insert_head_node(3).unwrap();

    let s1 = kernel.connect(src, tgt1, 10).unwrap();
    let s2 = kernel.connect(src, tgt2, 20).unwrap();

    kernel.disconnect_synapse(s1).unwrap();

    assert_eq!(kernel.get_node(src).get_outgoing_synapse_head(), s2);
    assert_eq!(kernel.get_node(src).get_outgoing_synapse_tail(), s2);
    assert_eq!(kernel.get_synapse(s2).get_outgoing_prev_ptr(), 0);
}

#[test]
fn disconnect_then_publish_reclaims_synapse_slot() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();

    // fill all synapse slots
    let mut synapses = Vec::new();
    for i in 0..32 {
        synapses.push(kernel.connect(src, tgt, i).unwrap());
    }
    assert!(
        kernel.connect(src, tgt, 99).is_err(),
        "synapse capacity full"
    );

    kernel.disconnect_synapse(synapses[0]).unwrap();

    // not yet reclaimed
    assert!(
        kernel.connect(src, tgt, 99).is_err(),
        "still deferred"
    );

    kernel.publish();
    
    // explicitly acknowledge the generation boundary
    TestConsumer::new(kernel.get_control_plane()).acquire_mirror();
    
    kernel.publish(); // Two cycle deferral required to physically reclaim

    // now reclaimed
    assert!(
        kernel.connect(src, tgt, 99).is_ok(),
        "reclaimed after publish"
    );
}

/* fn double_disconnect_returns_error() {
    let kernel = Kernel::new(config());
    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.disconnect(syn).unwrap();
    /* commented err check */
} */
// ============ Node attributes ============
#[test]
fn set_node_attribute_single_field() {
    let mut kernel = create_writer();
    let slot = kernel.insert_head_node(1).unwrap();

    kernel.get_node(slot).attr_write(0, 60); // pitch
    kernel.get_node(slot).attr_write(1, 100); // velocity

    assert_eq!(kernel.get_node(slot).attr_read(0), 60);
    assert_eq!(kernel.get_node(slot).attr_read(1), 100);
}

#[test]
fn set_node_attributes_bulk() {
    let mut kernel = create_writer();
    let slot = kernel.insert_head_node(1).unwrap();

    kernel.get_node(slot).attr_write(0, 72);
    kernel.get_node(slot).attr_write(1, 90);
    kernel.get_node(slot).attr_write(2, 960);
    kernel.get_node(slot).attr_write(3, 64);
    kernel.get_node(slot).attr_write(4, 10);
    kernel.get_node(slot).attr_write(5, 20);
    kernel.get_node(slot).attr_write(6, 30);
    kernel.get_node(slot).attr_write(7, -3);
    kernel.get_node(slot).attr_write(8, 7);
    kernel.get_node(slot).attr_write(9, 0);

    assert_eq!(kernel.get_node(slot).attr_read(0), 72);
    assert_eq!(kernel.get_node(slot).attr_read(1), 90);
    assert_eq!(kernel.get_node(slot).attr_read(2), 960);
}

#[test]
fn get_node_attributes_returns_view() {
    let mut kernel = create_writer();
    let slot = kernel.insert_head_node(1).unwrap();

    kernel.get_node(slot).attr_write(0, 42);
    kernel.get_node(slot).attr_write(5, 99);

    // The standalone `get_node_attributes(slot)` view type is gone; the new API
    // returns attributes via `get_node(slot).attr_read(...)` / `attr_read_all()`.
    assert_eq!(kernel.get_node(slot).attr_read(0), 42);
    assert_eq!(kernel.get_node(slot).attr_read(5), 99);
    let mut buf = [0i32; NODE_ATTR];
    kernel.get_node(slot).attr_read_all(&mut buf);
    assert_eq!(buf[0], 42);
    assert_eq!(buf[5], 99);
}

#[test]
fn node_attributes_independent_across_slots() {
    let mut kernel = create_writer();
    let a = kernel.insert_head_node(1).unwrap();
    let b = kernel.insert_head_node(2).unwrap();

    kernel.get_node(a).attr_write(0, 111);
    kernel.get_node(b).attr_write(0, 222);

    assert_eq!(kernel.get_node(a).attr_read(0), 111);
    assert_eq!(kernel.get_node(b).attr_read(0), 222);
}

// ============ Synapse attributes ============

#[test]
fn set_synapse_attribute_single_field() {
    let mut kernel = create_writer();
    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.get_synapse(syn).attr_write(0, 1000); // weight
    kernel.get_synapse(syn).attr_write(1, -10); // tick_offset

    assert_eq!(kernel.get_synapse(syn).attr_read(0), 1000);
    assert_eq!(kernel.get_synapse(syn).attr_read(1), -10);
}

#[test]
fn set_synapse_attributes_bulk() {
    let mut kernel = create_writer();
    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.get_synapse(syn).attr_write(0, 500);
    kernel.get_synapse(syn).attr_write(1, 3);
    kernel.get_synapse(syn).attr_write(2, -7);
    kernel.get_synapse(syn).attr_write(3, 100);
    kernel.get_synapse(syn).attr_write(4, 200);
    kernel.get_synapse(syn).attr_write(5, 50);

    assert_eq!(kernel.get_synapse(syn).attr_read(0), 500);
    assert_eq!(kernel.get_synapse(syn).attr_read(1), 3);
    assert_eq!(kernel.get_synapse(syn).attr_read(2), -7);
}

// ============ Publish lifecycle ============

#[test]
fn publish_succeeds_on_empty_kernel() {
    let mut kernel = create_writer();
    kernel.publish();
}

#[test]
fn publish_after_mutations_succeeds() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    kernel.connect(src, tgt, 10).unwrap();

    kernel.publish();
}

#[test]
fn multiple_publish_cycles() {
    let mut kernel = create_writer();

    // cycle 1: insert
    let a = kernel.insert_head_node(1).unwrap();
    kernel.publish();

    // cycle 2: insert + remove
    let _b = kernel.insert_head_node(2).unwrap();
    kernel.remove_node(a).unwrap();
    kernel.publish();

    // cycle 3: a's slot should be reclaimed now
    let _c = kernel.insert_head_node(3).unwrap();
    kernel.publish();

    // chain should have c and b (a was removed)
    let head = kernel.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 3);
}

#[test]
fn deferred_free_two_cycle_delay() {
    let mut kernel = create_writer();

    // fill capacity
    let mut slots = Vec::new();
    for i in 0..16 {
        slots.push(kernel.insert_head_node(i).unwrap());
    }

    // remove in cycle 0 (pushes to current deferred list)
    kernel.remove_node(slots[0]).unwrap();

    // publish #1: drains previous list (empty), toggles.
    // Now slots[0] is in the "previous" list.
    kernel.publish();
    
    // explicitly acknowledge the generation boundary
    TestConsumer::new(kernel.get_control_plane()).acquire_mirror();

    // publish #2: drains previous list (contains slots[0]). Slot reclaimed.
    kernel.publish();

    // slot should be available now
    assert!(kernel.insert_head_node(99).is_ok());
}

// ============ Self-loop ============

#[test]
fn self_loop_connect_disconnect() {
    let mut kernel = create_writer();
    let n = kernel.insert_head_node(1).unwrap();

    let syn = kernel.connect(n, n, 99).unwrap();

    assert_eq!(kernel.get_node(n).get_outgoing_synapse_head(), syn);
    assert_eq!(kernel.get_node(n).get_incoming_synapse_head(), syn);

    kernel.disconnect_synapse(syn).unwrap();

    assert_eq!(kernel.get_node(n).get_outgoing_synapse_head(), 0);
    assert_eq!(kernel.get_node(n).get_incoming_synapse_head(), 0);
}

// ============ compute_mem_size ============

#[test]
fn calculate_mem_size_is_positive() {
    let cfg = config();
    assert!(TestKernel::calculate_size_on_mem(&cfg) > 0);
}

// ============ Grow (absorbed copy_from semantics) ============
//
// `Kernel::copy_from` is gone. `Kernel::grow(new_config)` is the public
// replacement: it allocates a larger backing buffer, migrates all state
// (topology + attributes) into it, and hot-swaps the consumer's mirror via
// the `ControlPlane`. The topology-preservation assertion below is what the
// old `copy_from_scales_full_topology_graph` test guarded.

#[test]
fn grow_scales_full_topology_graph() {
    let mut kernel = create_writer();

    let src = kernel.insert_head_node(1).unwrap();
    let tgt = kernel.insert_head_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.get_node(src).attr_write(0, 60);
    kernel.publish();

    kernel
        .grow(common::kernel_config_1_1(
            32,
            64,
            NODE_META,
            NODE_ATTR,
            SYNAPSE_META,
            SYNAPSE_ATTR,
        ))
        .unwrap();

    // Nodes survived
    let n_src = kernel.get_node(src);
    assert_eq!(n_src.get_kind(), 1);
    let n_tgt = kernel.get_node(tgt);
    assert_eq!(n_tgt.get_kind(), 2);

    // Synapse survived
    let s_syn = kernel.get_synapse(syn);
    assert_eq!(s_syn.get_kind(), 10);
    assert_eq!(s_syn.get_source_ptr(), src);
    assert_eq!(s_syn.get_target_ptr(), tgt);

    // Structural links intact
    assert_eq!(n_src.get_outgoing_synapse_head(), syn);
    assert_eq!(n_tgt.get_incoming_synapse_head(), syn);

    // Attributes survived
    assert_eq!(kernel.get_node(src).attr_read(0), 60);
}

#[test]
fn grow_rejects_smaller_capacity() {
    use synaptic_kernel::errors::kernel_error::KernelError;

    let mut kernel = create_writer();

    // Current kernel was created with node_capacity = 16, synapse_capacity = 32.
    // Attempting to grow into a smaller config must fail with InsufficientCapacity
    // rather than silently truncate — this is the modern replacement for the
    // `copy_from_panics_if_source_larger` invariant.
    let result = kernel.grow(common::kernel_config_1_1(
        8,
        16,
        NODE_META,
        NODE_ATTR,
        SYNAPSE_META,
        SYNAPSE_ATTR,
    ));
    assert!(matches!(result, Err(KernelError::InsufficientCapacity)));
}
