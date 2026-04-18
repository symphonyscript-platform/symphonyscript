use synaptic_kernel::constants::{NODE_SIZE, SYNAPSE_SIZE};
use synaptic_kernel::synaptic_graph_config::SynapticGraphConfig;
use synaptic_kernel::synaptic_graph_writer::SynapticGraphWriter;

use std::sync::atomic::AtomicI32;
use std::sync::Arc;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type Gw = SynapticGraphWriter<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config() -> SynapticGraphConfig {
    SynapticGraphConfig {
        node_capacity: 16,
        synapse_capacity: 32,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn create_writer() -> Gw {
    let cfg = config();
    let size = Gw::calculate_size_on_mem(&cfg);
    let mem: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();
    Gw::new(Arc::new(mem), cfg)
}

fn insert_head_with_tick(kernel: &Gw, kind: i32, tick: i32) -> usize {
    let slot = kernel.insert_head(kind).unwrap();
    kernel.get_node(slot).set_meta(0, tick);
    slot
}

// ============ Construction ============

#[test]
fn kernel_new_creates_empty_chain() {
    let kernel = create_writer();
    assert!(kernel.get_head_node().is_none());
}

// ============ Node insertion ============

#[test]
fn insert_head_returns_slot() {
    let kernel = create_writer();
    let slot = kernel.insert_head(1);
    assert!(slot.is_some());
    assert!(slot.unwrap() > 0);
}

#[test]
fn insert_head_writes_kind_and_tick() {
    let kernel = create_writer();
    let slot = insert_head_with_tick(&kernel, 5, 999);

    let node = kernel.get_node(slot);
    assert_eq!(node.get_kind(), 5);
    assert_eq!(node.get_meta(0), 999);
}

#[test]
fn insert_head_chain_ordering() {
    let kernel = create_writer();

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
    let kernel = create_writer();

    let a = kernel.insert_head(1).unwrap();
    let c = kernel.insert_after(a, 3).unwrap();
    let b = kernel.insert_after(a, 2).unwrap();

    // chain: a -> b -> c (head is a since insert_head only called once)
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_next_ptr(), 0);
}

#[test]
fn insert_before_splices_correctly() {
    let kernel = create_writer();

    let a = kernel.insert_head(1).unwrap();
    let c = kernel.insert_after(a, 3).unwrap();
    let b = kernel.insert_before(c, 2).unwrap();

    // a -> b -> c
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_prev_ptr(), b);
}

#[test]
fn insert_exhausts_capacity() {
    let kernel = create_writer();

    for i in 0..16 {
        assert!(kernel.insert_head(i).is_some());
    }
    assert!(kernel.insert_head(99).is_none());
}

// ============ Node removal + deferred frees ============

#[test]
fn remove_node_heals_chain() {
    let kernel = create_writer();

    let a = kernel.insert_head(1).unwrap();
    let b = kernel.insert_head(2).unwrap();
    let c = kernel.insert_head(3).unwrap();
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
        slots.push(kernel.insert_head(i).unwrap());
    }
    assert!(kernel.insert_head(99).is_none(), "capacity full");

    // remove one
    kernel.remove_node(slots[0]).unwrap();

    // slot not yet reclaimed (deferred)
    assert!(kernel.insert_head(99).is_none(), "still deferred");

    // publish #1: shift to previous list
    kernel.publish();

    // explicitly acknowledge the generation boundary
    kernel.to_reader().swap();

    // publish #2: drains the previous list
    kernel.publish();

    // now the slot is available
    let reclaimed = kernel.insert_head(99);
    assert!(reclaimed.is_some(), "slot reclaimed after publish");
}

/* fn double_remove_returns_error() {
    let kernel = Kernel::new(config());
    let a = kernel.insert_head(1).unwrap();
    kernel.remove_node(a).unwrap();
    /* commented err check */
} */
// ============ Synapse connect/disconnect ============
#[test]
fn connect_creates_synapse() {
    let kernel = create_writer();

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();

    let syn = kernel.connect(src, tgt, 10).unwrap();

    let s = kernel.get_synapse(syn);
    assert_eq!(s.get_kind(), 10);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
}

#[test]
fn connect_updates_node_synapse_pointers() {
    let kernel = create_writer();

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    assert_eq!(kernel.get_node(src).get_outgoing_synapse_head(), syn);
    assert_eq!(kernel.get_node(src).get_outgoing_synapse_tail(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_head(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_tail(), syn);
}

#[test]
fn disconnect_heals_synapse_chain() {
    let kernel = create_writer();

    let src = kernel.insert_head(1).unwrap();
    let tgt1 = kernel.insert_head(2).unwrap();
    let tgt2 = kernel.insert_head(3).unwrap();

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

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();

    // fill all synapse slots
    let mut synapses = Vec::new();
    for i in 0..32 {
        synapses.push(kernel.connect(src, tgt, i).unwrap());
    }
    assert!(
        kernel.connect(src, tgt, 99).is_none(),
        "synapse capacity full"
    );

    kernel.disconnect_synapse(synapses[0]).unwrap();

    // not yet reclaimed
    assert!(
        kernel.connect(src, tgt, 99).is_none(),
        "still deferred"
    );

    kernel.publish();
    
    // explicitly acknowledge the generation boundary
    kernel.to_reader().swap();
    
    kernel.publish(); // Two cycle deferral required to physically reclaim

    // now reclaimed
    assert!(
        kernel.connect(src, tgt, 99).is_some(),
        "reclaimed after publish"
    );
}

/* fn double_disconnect_returns_error() {
    let kernel = Kernel::new(config());
    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.disconnect(syn).unwrap();
    /* commented err check */
} */
// ============ Node attributes ============
#[test]
fn set_node_attribute_single_field() {
    let kernel = create_writer();
    let slot = kernel.insert_head(1).unwrap();

    kernel.set_node_attribute(slot, 0, 60); // pitch
    kernel.set_node_attribute(slot, 1, 100); // velocity

    assert_eq!(kernel.get_node_attribute(slot, 0), 60);
    assert_eq!(kernel.get_node_attribute(slot, 1), 100);
}

#[test]
fn set_node_attributes_bulk() {
    let kernel = create_writer();
    let slot = kernel.insert_head(1).unwrap();

    kernel.set_node_attribute(slot, 0, 72);
    kernel.set_node_attribute(slot, 1, 90);
    kernel.set_node_attribute(slot, 2, 960);
    kernel.set_node_attribute(slot, 3, 64);
    kernel.set_node_attribute(slot, 4, 10);
    kernel.set_node_attribute(slot, 5, 20);
    kernel.set_node_attribute(slot, 6, 30);
    kernel.set_node_attribute(slot, 7, -3);
    kernel.set_node_attribute(slot, 8, 7);
    kernel.set_node_attribute(slot, 9, 0);

    assert_eq!(kernel.get_node_attribute(slot, 0), 72);
    assert_eq!(kernel.get_node_attribute(slot, 1), 90);
    assert_eq!(kernel.get_node_attribute(slot, 2), 960);
}

#[test]
fn get_node_attributes_returns_view() {
    let kernel = create_writer();
    let slot = kernel.insert_head(1).unwrap();

    kernel.set_node_attribute(slot, 0, 42);
    kernel.set_node_attribute(slot, 5, 99);

    let view = kernel.get_node_attributes(slot);
    assert_eq!(view.read(0), 42);
    assert_eq!(view.read(5), 99);
}

#[test]
fn node_attributes_independent_across_slots() {
    let kernel = create_writer();
    let a = kernel.insert_head(1).unwrap();
    let b = kernel.insert_head(2).unwrap();

    kernel.set_node_attribute(a, 0, 111);
    kernel.set_node_attribute(b, 0, 222);

    assert_eq!(kernel.get_node_attribute(a, 0), 111);
    assert_eq!(kernel.get_node_attribute(b, 0), 222);
}

// ============ Synapse attributes ============

#[test]
fn set_synapse_attribute_single_field() {
    let kernel = create_writer();
    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.set_synapse_attribute(syn, 0, 1000); // weight
    kernel.set_synapse_attribute(syn, 1, -10); // tick_offset

    assert_eq!(kernel.get_synapse_attribute(syn, 0), 1000);
    assert_eq!(kernel.get_synapse_attribute(syn, 1), -10);
}

#[test]
fn set_synapse_attributes_bulk() {
    let kernel = create_writer();
    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.set_synapse_attribute(syn, 0, 500);
    kernel.set_synapse_attribute(syn, 1, 3);
    kernel.set_synapse_attribute(syn, 2, -7);
    kernel.set_synapse_attribute(syn, 3, 100);
    kernel.set_synapse_attribute(syn, 4, 200);
    kernel.set_synapse_attribute(syn, 5, 50);

    assert_eq!(kernel.get_synapse_attribute(syn, 0), 500);
    assert_eq!(kernel.get_synapse_attribute(syn, 1), 3);
    assert_eq!(kernel.get_synapse_attribute(syn, 2), -7);
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

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    kernel.connect(src, tgt, 10).unwrap();

    kernel.publish();
}

#[test]
fn multiple_publish_cycles() {
    let mut kernel = create_writer();

    // cycle 1: insert
    let a = kernel.insert_head(1).unwrap();
    kernel.publish();

    // cycle 2: insert + remove
    let _b = kernel.insert_head(2).unwrap();
    kernel.remove_node(a).unwrap();
    kernel.publish();

    // cycle 3: a's slot should be reclaimed now
    let _c = kernel.insert_head(3).unwrap();
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
        slots.push(kernel.insert_head(i).unwrap());
    }

    // remove in cycle 0 (pushes to current deferred list)
    kernel.remove_node(slots[0]).unwrap();

    // publish #1: drains previous list (empty), toggles.
    // Now slots[0] is in the "previous" list.
    kernel.publish();
    
    // explicitly acknowledge the generation boundary
    kernel.to_reader().swap();

    // publish #2: drains previous list (contains slots[0]). Slot reclaimed.
    kernel.publish();

    // slot should be available now
    assert!(kernel.insert_head(99).is_some());
}

// ============ Self-loop ============

#[test]
fn self_loop_connect_disconnect() {
    let kernel = create_writer();
    let n = kernel.insert_head(1).unwrap();

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
    assert!(Gw::calculate_size_on_mem(&cfg) > 0);
}

#[test]
fn calculate_tb_size_matches_slot_count() {
    let cfg = config();
    let expected = cfg.tb_metadata_size
        + (1 + cfg.node_capacity * (NODE_SIZE + NODE_META))
        + cfg.synapse_capacity * (SYNAPSE_SIZE + SYNAPSE_META);
    assert_eq!(Gw::calculate_size_on_tb(&cfg), expected);
}

// ============ Copy From ============

#[test]
fn copy_from_scales_full_topology_graph() {
    let small_cfg = config();
    let small_mem: Vec<AtomicI32> = (0..Gw::calculate_size_on_mem(&small_cfg))
        .map(|_| AtomicI32::new(0))
        .collect();
    let mut small_kernel = Gw::new(Arc::new(small_mem), small_cfg.clone());

    let src = small_kernel.insert_head(1).unwrap();
    let tgt = small_kernel.insert_head(2).unwrap();
    let syn = small_kernel.connect(src, tgt, 10).unwrap();

    small_kernel.set_node_attribute(src, 0, 60);

    small_kernel.publish();

    let mut large_cfg = config();
    large_cfg.node_capacity = 32;
    large_cfg.synapse_capacity = 64;
    let large_mem: Vec<AtomicI32> = (0..Gw::calculate_size_on_mem(&large_cfg))
        .map(|_| AtomicI32::new(0))
        .collect();
    let large_kernel = Gw::new(Arc::new(large_mem), large_cfg);

    large_kernel.copy_from(&small_kernel);

    // Validate nodes survived
    let n_src = large_kernel.get_node(src);
    assert_eq!(n_src.get_kind(), 1);

    let n_tgt = large_kernel.get_node(tgt);
    assert_eq!(n_tgt.get_kind(), 2);

    // Validate synapse survived
    let s_syn = large_kernel.get_synapse(syn);
    assert_eq!(s_syn.get_kind(), 10);
    assert_eq!(s_syn.get_source_ptr(), src);
    assert_eq!(s_syn.get_target_ptr(), tgt);

    // Validate structural links
    assert_eq!(n_src.get_outgoing_synapse_head(), syn);
    assert_eq!(n_tgt.get_incoming_synapse_head(), syn);

    // Validate attributes survived
    assert_eq!(large_kernel.get_node_attribute(src, 0), 60);
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let mut small_cfg = config();
    small_cfg.node_capacity = 16;
    let small_mem: Vec<AtomicI32> = (0..Gw::calculate_size_on_mem(&small_cfg))
        .map(|_| AtomicI32::new(0))
        .collect();
    let small_kernel = Gw::new(Arc::new(small_mem), small_cfg);

    let mut large_cfg = config();
    large_cfg.node_capacity = 32;
    let large_mem: Vec<AtomicI32> = (0..Gw::calculate_size_on_mem(&large_cfg))
        .map(|_| AtomicI32::new(0))
        .collect();
    let large_kernel = Gw::new(Arc::new(large_mem), large_cfg);

    small_kernel.copy_from(&large_kernel);
}
