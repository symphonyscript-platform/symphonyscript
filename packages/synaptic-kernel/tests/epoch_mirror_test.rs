use synaptic_kernel::kernel_config::KernelConfig;
use synaptic_kernel::epoch_mirror::EpochMirror;
use synaptic_kernel::epoch::Epoch;

use std::sync::atomic::AtomicI32;
use std::sync::Arc;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type Gw = Epoch<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;
type Gr = EpochMirror<NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR>;

fn config() -> KernelConfig {
    KernelConfig {
        node_capacity: 16,
        synapse_capacity: 32,
        mem_metadata_size: 1,
        tb_metadata_size: 1,
    }
}

fn setup() -> (Gw, Gr) {
    let cfg = config();
    let size = Gw::calculate_size_on_mem(&cfg);
    let mem: Vec<AtomicI32> = (0..size).map(|_| AtomicI32::new(0)).collect();
    let mem_arc = Arc::new(mem);

    let kernel = Gw::new(Arc::clone(&mem_arc), cfg.clone());
    let reader = kernel.to_mirror();
    (kernel, reader)
}

fn insert_head_with_tick(kernel: &Gw, kind: i32, tick: i32) -> usize {
    let slot = kernel.insert_head(kind).unwrap();
    kernel.get_node(slot).set_meta(0, tick);
    slot
}

// ============ Construction ============

#[test]
fn reader_bind_creates_empty_chain() {
    let (_kernel, reader) = setup();
    assert!(reader.get_head_node().is_none());
}

// ============ Reader sees nothing before publish/swap ============

#[test]
fn reader_does_not_see_unpublished_nodes() {
    let (kernel, reader) = setup();

    kernel.insert_head(1).unwrap();

    // no publish, no swap
    assert!(reader.get_head_node().is_none());
}

// ============ Reader sees nodes after publish + swap ============

#[test]
fn reader_sees_nodes_after_publish_swap() {
    let (kernel, reader) = setup();

    let _slot = insert_head_with_tick(&kernel, 5, 999);
    kernel.publish();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 5);
    assert_eq!(head.get_meta(0), 999);
}

#[test]
fn reader_traverses_full_chain() {
    let (kernel, reader) = setup();

    let _a = insert_head_with_tick(&kernel, 1, 10);
    let _b = insert_head_with_tick(&kernel, 2, 20);
    let _c = insert_head_with_tick(&kernel, 3, 30);
    // chain: c -> b -> a

    kernel.publish();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 3);

    let n_b = reader.get_node(head.get_next_ptr());
    assert_eq!(n_b.get_kind(), 2);

    let n_a = reader.get_node(n_b.get_next_ptr());
    assert_eq!(n_a.get_kind(), 1);
    assert_eq!(n_a.get_next_ptr(), 0);
}

// ============ Reader sees removal after publish ============

#[test]
fn reader_sees_removal_after_publish_swap() {
    let (kernel, reader) = setup();

    let _a = kernel.insert_head(1).unwrap();
    let b = kernel.insert_head(2).unwrap();
    // chain: b -> a

    kernel.remove_node(b).unwrap();
    // chain: a

    kernel.publish();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0);
}

// ============ Reader snapshot isolation ============

#[test]
fn reader_retains_old_snapshot_without_swap() {
    let (kernel, reader) = setup();

    // cycle 1
    let _a = kernel.insert_head(1).unwrap();
    kernel.publish();
    reader.swap();

    // cycle 2: mutate but reader does NOT swap
    kernel.insert_head(2).unwrap();
    kernel.publish();

    // reader still sees cycle 1 snapshot
    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn reader_sees_updated_snapshot_after_swap() {
    let (kernel, reader) = setup();

    // cycle 1
    kernel.insert_head(1).unwrap();
    kernel.publish();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 1);

    // cycle 2
    kernel.insert_head(2).unwrap();
    kernel.publish();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 2);
}

// ============ Reader sees synapse data ============

#[test]
fn reader_sees_synapse_after_publish_swap() {
    let (kernel, reader) = setup();

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 42).unwrap();

    kernel.publish();
    reader.swap();

    let s = reader.get_synapse(syn);
    assert_eq!(s.get_kind(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
}

#[test]
fn reader_traverses_synapse_chain() {
    let (kernel, reader) = setup();

    let src = kernel.insert_head(1).unwrap();
    let tgt1 = kernel.insert_head(2).unwrap();
    let tgt2 = kernel.insert_head(3).unwrap();
    let tgt3 = kernel.insert_head(4).unwrap();

    let s1 = kernel.connect(src, tgt1, 10).unwrap();
    let s2 = kernel.connect(src, tgt2, 20).unwrap();
    let s3 = kernel.connect(src, tgt3, 30).unwrap();

    kernel.publish();
    reader.swap();

    // find src's outgoing head via the node reader
    let src_node = reader.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);

    // traverse: s1 -> s2 -> s3 -> 0
    let r1 = reader.get_synapse(s1);
    assert_eq!(r1.get_kind(), 10);
    assert_eq!(r1.get_outgoing_next_ptr(), s2);

    let r2 = reader.get_synapse(s2);
    assert_eq!(r2.get_kind(), 20);
    assert_eq!(r2.get_outgoing_next_ptr(), s3);

    let r3 = reader.get_synapse(s3);
    assert_eq!(r3.get_kind(), 30);
    assert_eq!(r3.get_outgoing_next_ptr(), 0);
}

#[test]
fn reader_sees_disconnect_after_publish_swap() {
    let (kernel, reader) = setup();

    let src = kernel.insert_head(1).unwrap();
    let tgt1 = kernel.insert_head(2).unwrap();
    let tgt2 = kernel.insert_head(3).unwrap();

    let s1 = kernel.connect(src, tgt1, 10).unwrap();
    let s2 = kernel.connect(src, tgt2, 20).unwrap();

    kernel.disconnect_synapse(s1).unwrap();

    kernel.publish();
    reader.swap();

    let src_node = reader.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s2);

    let r2 = reader.get_synapse(s2);
    assert_eq!(r2.get_outgoing_prev_ptr(), 0, "s2 is now head");
    assert_eq!(r2.get_outgoing_next_ptr(), 0, "s2 is now tail");
}

// ============ Reader sees attributes (shared plane) ============

#[test]
fn reader_sees_node_attributes_immediately() {
    let (kernel, reader) = setup();

    let slot = kernel.insert_head(1).unwrap();

    // attributes are on shared plane — visible without publish
    kernel.set_node_attribute(slot, 0, 60); // pitch
    kernel.set_node_attribute(slot, 1, 100); // velocity

    assert_eq!(reader.get_node_attribute(slot, 0), 60);
    assert_eq!(reader.get_node_attribute(slot, 1), 100);
}

#[test]
fn reader_sees_bulk_node_attributes() {
    let (kernel, reader) = setup();

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

    let view = reader.get_node_attributes(slot);
    assert_eq!(view.read(0), 72);
    assert_eq!(view.read(1), 90);
    assert_eq!(view.read(2), 960);
    assert_eq!(view.read(3), 64);
}

#[test]
fn reader_sees_synapse_attributes_immediately() {
    let (kernel, reader) = setup();

    let src = kernel.insert_head(1).unwrap();
    let tgt = kernel.insert_head(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.set_synapse_attribute(syn, 0, 500);
    kernel.set_synapse_attribute(syn, 1, 3);
    kernel.set_synapse_attribute(syn, 2, -7);
    kernel.set_synapse_attribute(syn, 3, 100);
    kernel.set_synapse_attribute(syn, 4, 200);
    kernel.set_synapse_attribute(syn, 5, 50);

    assert_eq!(reader.get_synapse_attribute(syn, 0), 500);
    assert_eq!(reader.get_synapse_attribute(syn, 1), 3);
    assert_eq!(reader.get_synapse_attribute(syn, 2), -7);
}

#[test]
fn reader_attributes_view_matches_individual_reads() {
    let (kernel, reader) = setup();

    let slot = kernel.insert_head(1).unwrap();
    kernel.set_node_attribute(slot, 0, 42);
    kernel.set_node_attribute(slot, 5, 99);

    let view = reader.get_node_attributes(slot);
    assert_eq!(view.read(0), reader.get_node_attribute(slot, 0));
    assert_eq!(view.read(5), reader.get_node_attribute(slot, 5));
}

// ============ Multi-cycle with reader ============

#[test]
fn multi_cycle_insert_remove_connect_disconnect() {
    let (kernel, reader) = setup();

    // cycle 1: build graph A->B with synapse
    let a = insert_head_with_tick(&kernel, 1, 100);
    let b = insert_head_with_tick(&kernel, 2, 200);
    let s1 = kernel.connect(a, b, 10).unwrap();
    kernel.set_node_attribute(a, 0, 60); // pitch of A
    kernel.publish();
    reader.swap();

    // verify cycle 1 snapshot
    assert_eq!(reader.get_node(a).get_kind(), 1);
    assert_eq!(reader.get_node(b).get_kind(), 2);
    assert_eq!(reader.get_synapse(s1).get_kind(), 10);
    assert_eq!(reader.get_node_attribute(a, 0), 60);

    // cycle 2: add C, connect B->C, disconnect A->B
    let c = insert_head_with_tick(&kernel, 3, 300);
    let s2 = kernel.connect(b, c, 20).unwrap();
    kernel.disconnect_synapse(s1).unwrap();
    kernel.publish();
    reader.swap();

    // verify cycle 2 snapshot
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 3);
    let b_node = reader.get_node(b);
    assert_eq!(b_node.get_outgoing_synapse_head(), s2);
    assert_eq!(reader.get_synapse(s2).get_source_ptr(), b);
    assert_eq!(reader.get_synapse(s2).get_target_ptr(), c);

    // A's outgoing should be empty after disconnect
    assert_eq!(reader.get_node(a).get_outgoing_synapse_head(), 0);
}

// ============ swap() return value ============

#[test]
fn swap_returns_false_when_no_new_data() {
    let (_kernel, reader) = setup();
    assert!(!reader.swap(), "no publish happened");
}

#[test]
fn swap_returns_true_when_new_data() {
    let (kernel, reader) = setup();
    kernel.insert_head(1).unwrap();
    kernel.publish();
    assert!(reader.swap(), "publish happened");
}

// ============ Empty chain after removing all ============

#[test]
fn reader_sees_empty_chain_after_removing_all() {
    let (kernel, reader) = setup();

    let a = kernel.insert_head(1).unwrap();
    let b = kernel.insert_head(2).unwrap();

    kernel.remove_node(a).unwrap();
    kernel.remove_node(b).unwrap();

    kernel.publish();
    reader.swap();

    assert!(reader.get_head_node().is_none());
}

// ============ Attribute mutation visible between publishes ============

#[test]
fn attribute_mutation_visible_between_publishes() {
    let (kernel, reader) = setup();

    let slot = kernel.insert_head(1).unwrap();
    kernel.publish();
    reader.swap();

    // mutate attribute WITHOUT publishing
    kernel.set_node_attribute(slot, 0, 999);

    // reader sees it immediately (shared plane, not triple-buffered)
    assert_eq!(reader.get_node_attribute(slot, 0), 999);
}
