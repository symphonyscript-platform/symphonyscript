mod common;

use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::epoch_mirror::EpochMirror;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;
use synaptic_kernel::primitives::entry_store_def::EntryStoreId;
use synaptic_kernel::primitives::triple_buffer_def::TripleBufferId;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<1, 1, 1>;
type TestConsumer = EpochConsumer<1, 1, 1>;
type TestMirror = EpochMirror<1, 1, 1>;

fn config() -> KernelConfig<1, 1, 1> {
    common::kernel_config_1_1(16, 32, NODE_META, NODE_ATTR, SYNAPSE_META, SYNAPSE_ATTR)
}

/// Leaks an `EpochConsumer` + `EpochMirror` pair so the test body can hold a
/// `&'static EpochMirror` alongside the mutable `Kernel` without fighting the
/// borrow checker. This mirrors the production topology where the consumer
/// lives on a separate thread and owns its own `EpochConsumer`.
fn setup() -> (TestKernel, &'static TestMirror) {
    let kernel = TestKernel::new(config());
    let consumer: &'static mut TestConsumer =
        Box::leak(Box::new(TestConsumer::new(kernel.get_control_plane())));
    let reader: &'static TestMirror = consumer.acquire_mirror();
    (kernel, reader)
}

fn insert_head_with_tick(kernel: &TestKernel, kind: i32, tick: i32) -> usize {
    let slot = kernel.insert_node(kind).unwrap();
    // Tick is stored on the TB (meta) plane so the publish/swap boundary
    // is what makes it visible to the reader. `kind` goes via
    // `insert_head_node` (structural), `tick` via `set_meta` (meta zone).
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
    let (mut kernel, reader) = setup();

    kernel.insert_node(1).unwrap();

    // no publish, no swap
    assert!(reader.get_head_node().is_none());
}

// ============ Reader sees nodes after publish + swap ============

#[test]
fn reader_sees_nodes_after_publish_swap() {
    let (mut kernel, reader) = setup();

    let slot = insert_head_with_tick(&kernel, 5, 999);

    // Before publish+swap: TB (meta) plane has not shifted into the reader's
    // active buffer, so the freshly-written meta MUST NOT be visible yet.
    // This is the whole contract of the triple-buffer publish boundary.
    assert_ne!(
        reader.get_node(slot).get_meta(0),
        999,
        "meta must not be visible before publish+swap",
    );

    kernel.publish();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 5);
    // After publish+swap: the TB snapshot now exposes the meta write.
    assert_eq!(head.get_meta(0), 999);
}

#[test]
fn reader_traverses_full_chain() {
    let (mut kernel, reader) = setup();

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
    let (mut kernel, reader) = setup();

    let _a = kernel.insert_node(1).unwrap();
    let b = kernel.insert_node(2).unwrap();
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
    let (mut kernel, reader) = setup();

    // cycle 1
    let _a = kernel.insert_node(1).unwrap();
    kernel.publish();
    reader.swap();

    // cycle 2: mutate but reader does NOT swap
    kernel.insert_node(2).unwrap();
    kernel.publish();

    // reader still sees cycle 1 snapshot
    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn reader_sees_updated_snapshot_after_swap() {
    let (mut kernel, reader) = setup();

    // cycle 1
    kernel.insert_node(1).unwrap();
    kernel.publish();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 1);

    // cycle 2
    kernel.insert_node(2).unwrap();
    kernel.publish();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 2);
}

// ============ Reader sees synapse data ============

#[test]
fn reader_sees_synapse_after_publish_swap() {
    let (mut kernel, reader) = setup();

    let src = kernel.insert_node(1).unwrap();
    let tgt = kernel.insert_node(2).unwrap();
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
    let (mut kernel, reader) = setup();

    let src = kernel.insert_node(1).unwrap();
    let tgt1 = kernel.insert_node(2).unwrap();
    let tgt2 = kernel.insert_node(3).unwrap();
    let tgt3 = kernel.insert_node(4).unwrap();

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
    let (mut kernel, reader) = setup();

    let src = kernel.insert_node(1).unwrap();
    let tgt1 = kernel.insert_node(2).unwrap();
    let tgt2 = kernel.insert_node(3).unwrap();

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
    let (mut kernel, reader) = setup();

    let slot = kernel.insert_node(1).unwrap();

    // attributes are on shared plane — visible without publish
    kernel.get_node(slot).attr_write(0, 60); // pitch
    kernel.get_node(slot).attr_write(1, 100); // velocity

    assert_eq!(reader.get_node(slot).attr_read(0), 60);
    assert_eq!(reader.get_node(slot).attr_read(1), 100);
}

#[test]
fn reader_sees_bulk_node_attributes() {
    let (mut kernel, reader) = setup();

    let slot = kernel.insert_node(1).unwrap();

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

    let mut view = [0i32; NODE_ATTR];
    reader.get_node(slot).attr_read_all(&mut view);
    assert_eq!(view[0], 72);
    assert_eq!(view[1], 90);
    assert_eq!(view[2], 960);
    assert_eq!(view[3], 64);
}

#[test]
fn reader_sees_synapse_attributes_immediately() {
    let (mut kernel, reader) = setup();

    let src = kernel.insert_node(1).unwrap();
    let tgt = kernel.insert_node(2).unwrap();
    let syn = kernel.connect(src, tgt, 10).unwrap();

    kernel.get_synapse(syn).attr_write(0, 500);
    kernel.get_synapse(syn).attr_write(1, 3);
    kernel.get_synapse(syn).attr_write(2, -7);
    kernel.get_synapse(syn).attr_write(3, 100);
    kernel.get_synapse(syn).attr_write(4, 200);
    kernel.get_synapse(syn).attr_write(5, 50);

    assert_eq!(reader.get_synapse(syn).attr_read(0), 500);
    assert_eq!(reader.get_synapse(syn).attr_read(1), 3);
    assert_eq!(reader.get_synapse(syn).attr_read(2), -7);
}

#[test]
fn reader_attributes_view_matches_individual_reads() {
    let (mut kernel, reader) = setup();

    let slot = kernel.insert_node(1).unwrap();
    kernel.get_node(slot).attr_write(0, 42);
    kernel.get_node(slot).attr_write(5, 99);

    let mut view = [0i32; NODE_ATTR];
    reader.get_node(slot).attr_read_all(&mut view);
    assert_eq!(view[0], reader.get_node(slot).attr_read(0));
    assert_eq!(view[5], reader.get_node(slot).attr_read(5));
}

// ============ Multi-cycle with reader ============

#[test]
fn multi_cycle_insert_remove_connect_disconnect() {
    let (mut kernel, reader) = setup();

    // cycle 1: build graph A->B with synapse
    let a = insert_head_with_tick(&kernel, 1, 100);
    let b = insert_head_with_tick(&kernel, 2, 200);
    let s1 = kernel.connect(a, b, 10).unwrap();
    kernel.get_node(a).attr_write(0, 60); // pitch of A
    kernel.publish();
    reader.swap();

    // verify cycle 1 snapshot
    assert_eq!(reader.get_node(a).get_kind(), 1);
    assert_eq!(reader.get_node(b).get_kind(), 2);
    assert_eq!(reader.get_synapse(s1).get_kind(), 10);
    assert_eq!(reader.get_node(a).attr_read(0), 60);

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
    let (mut kernel, reader) = setup();
    kernel.insert_node(1).unwrap();
    kernel.publish();
    assert!(reader.swap(), "publish happened");
}

// ============ Empty chain after removing all ============

#[test]
fn reader_sees_empty_chain_after_removing_all() {
    let (mut kernel, reader) = setup();

    let a = kernel.insert_node(1).unwrap();
    let b = kernel.insert_node(2).unwrap();

    kernel.remove_node(a).unwrap();
    kernel.remove_node(b).unwrap();

    kernel.publish();
    reader.swap();

    assert!(reader.get_head_node().is_none());
}

// ============ Attribute mutation visible between publishes ============

#[test]
fn attribute_mutation_visible_between_publishes() {
    let (mut kernel, reader) = setup();

    let slot = kernel.insert_node(1).unwrap();
    kernel.publish();
    reader.swap();

    // mutate attribute WITHOUT publishing
    kernel.get_node(slot).attr_write(0, 999);

    // reader sees it immediately (shared plane, not triple-buffered)
    assert_eq!(reader.get_node(slot).attr_read(0), 999);
}

#[test]
fn get_entry_store_returns_readable_store() {
    let (_kernel, reader) = setup();
    let store = reader.get_entry_store(EntryStoreId(0));
    assert!(store.capacity() > 0);
}

#[test]
fn swap_tb_only_affects_targeted_tb() {
    let (mut kernel, reader) = setup();

    kernel.get_user_tb(TripleBufferId(0)).write(0, 1234);
    let slot = insert_head_with_tick(&kernel, 5, 999);

    assert!(reader.get_head_node().is_none(), "topology not published yet");

    kernel.publish_tb(TripleBufferId(0));
    reader.swap_tb(TripleBufferId(0));
    assert_eq!(reader.get_user_tb(TripleBufferId(0)).read(0), 1234);

    assert_ne!(
        reader.get_node(slot).get_meta(0),
        999,
        "default TB meta must not be visible before kernel.publish + swap"
    );
    assert!(!reader.swap(), "default TB has no pending publish");

    kernel.publish();
    assert!(reader.swap());
    assert_eq!(reader.get_head_node().unwrap().get_kind(), 5);
    assert_eq!(reader.get_node(slot).get_meta(0), 999);
}

#[test]
fn entry_store_attr_visible_without_swap() {
    let (mut kernel, reader) = setup();
    let store = kernel.get_entry_store(EntryStoreId(0));
    let slot = store.insert().unwrap();
    store.get(slot).attr_write(0, 777);
    assert_eq!(
        reader.get_entry_store(EntryStoreId(0)).get(slot).attr_read(0),
        777
    );
}
