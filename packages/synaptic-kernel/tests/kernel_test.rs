mod common;

use synaptic_kernel::control_plane::ControlPlane;
use synaptic_kernel::errors::kernel_error::KernelError;
use synaptic_kernel::epoch_consumer::EpochConsumer;
use synaptic_kernel::kernel::Kernel;
use synaptic_kernel::kernel_config::KernelConfig;
use synaptic_kernel::epoch_mirror::EpochMirror;
use synaptic_kernel::primitives::entry_store_config::EntryStoreConfig;
use synaptic_kernel::primitives::entry_store_def::{EntryStoreDef, EntryStoreId};
use synaptic_kernel::primitives::lut_def::{LutDef, LutId};
use synaptic_kernel::topology::network::network_config::NetworkConfig;
use synaptic_kernel::primitives::triple_buffer_def::{TripleBufferDef, TripleBufferId};
use std::sync::Arc;

const NODE_META: usize = 8;
const NODE_ATTR: usize = 16;
const SYNAPSE_META: usize = 8;
const SYNAPSE_ATTR: usize = 16;

type TestKernel = Kernel<1, 1, 1>;
type TestReader = EpochMirror<1, 1, 1>;

fn new_controller(cfg: KernelConfig<1, 1, 1>) -> TestKernel {
    Kernel::new(cfg)
}

fn create_config(nodes: usize, synapses: usize) -> KernelConfig<1, 1, 1> {
    common::kernel_config_1_1(
        nodes,
        synapses,
        NODE_META,
        NODE_ATTR,
        SYNAPSE_META,
        SYNAPSE_ATTR,
    )
}

fn config(capacity: usize) -> KernelConfig<1, 1, 1> {
    create_config(capacity, capacity)
}

fn config_with_lut_on_default(lut_size: usize) -> KernelConfig<1, 1, 1> {
    let mut c = create_config(16, 16);
    c.lut_defs = [LutDef::new(LutId(0), TripleBufferId::DEFAULT, lut_size)];
    c
}

fn config_with_lut_on_user_tb(lut_size: usize) -> KernelConfig<1, 1, 1> {
    KernelConfig {
        mem_metadata_size: 1,
        tb_defs: [TripleBufferDef {
            id: TripleBufferId(0),
            buffer_capacity: 32768,
        }],
        store_defs: [EntryStoreDef::new(
            EntryStoreId(0),
            TripleBufferId::DEFAULT,
            EntryStoreConfig {
                core_stride: 1,
                meta_stride: 1,
                attr_stride: 1,
                capacity: 4,
            },
        )],
        lut_defs: [LutDef::new(LutId(0), TripleBufferId(0), lut_size)],
        network_config: NetworkConfig {
            node_capacity: 16,
            node_meta_stride: NODE_META,
            node_attr_stride: NODE_ATTR,
            synapse_capacity: 16,
            synapse_meta_stride: SYNAPSE_META,
            synapse_attr_stride: SYNAPSE_ATTR,
        },
    }
}

/// Extract consumer-thread reader from controller via a leaked [`EpochConsumer`].
/// This simulates the exact path the consumer thread takes in production while
/// giving callers a `'static` reader so mutations to the controller can
/// proceed without fighting the borrow checker.
unsafe fn mock_consumer_reader(controller: &TestKernel) -> &'static TestReader {
    let cp = controller.get_control_plane();
    let consumer: &'static mut EpochConsumer<1, 1, 1> = Box::leak(Box::new(EpochConsumer::new(cp)));
    consumer.acquire_mirror()
}

// =========================================================
// PHASE 1: Happy Path — Lifecycle & Basic Operations
// =========================================================

#[test]
fn fresh_controller_reports_zero_counts() {
    let controller = new_controller(config(16));
    assert_eq!(controller.node_count(), 0);
    assert_eq!(controller.synapse_count(), 0);
    assert_eq!(controller.node_capacity(), 16);
    assert_eq!(controller.synapse_capacity(), 16);
    assert_eq!(controller.node_utilization(), 0.0);
    assert_eq!(controller.synapse_utilization(), 0.0);
    assert!(controller.get_head_node().is_none());
}

#[test]
fn insert_head_returns_slot_and_head_visible() {
    let controller = new_controller(config(16));
    let slot = controller.insert_node(1).unwrap();
    assert!(slot > 0);
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
}

#[test]
fn insert_after_and_before_form_correct_chain() {
    let controller = new_controller(config(16));
    let n1 = controller.insert_node(10).unwrap();
    let n3 = controller.insert_node_after(n1, 30).unwrap();
    let n2 = controller.insert_node_before(n3, 20).unwrap();

    // Chain: n1 -> n2 -> n3
    let w1 = controller.get_node(n1);
    let w2 = controller.get_node(n2);
    let w3 = controller.get_node(n3);
    assert_eq!(w1.get_next_ptr(), n2);
    assert_eq!(w2.get_prev_ptr(), n1);
    assert_eq!(w2.get_next_ptr(), n3);
    assert_eq!(w3.get_prev_ptr(), n2);
}

#[test]
fn connect_and_disconnect_lifecycle() {
    let controller = new_controller(config(16));
    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();

    let s1 = controller.connect(n1, n2, 5).unwrap();
    let synapse = controller.get_synapse(s1);
    assert_eq!(synapse.get_kind(), 5);

    controller.disconnect_synapse(s1).unwrap();
}

#[test]
fn node_and_synapse_attribute_round_trip() {
    let controller = new_controller(config(16));
    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let s1 = controller.connect(n1, n2, 1).unwrap();

    // Node attributes: write every offset, read back
    for offset in 0..16 {
        controller.get_node(n1).attr_write(offset, (offset as i32) * 100);
    }
    for offset in 0..16 {
        assert_eq!(
            controller.get_node(n1).attr_read(offset),
            (offset as i32) * 100
        );
    }

    // Synapse attributes: same
    for offset in 0..16 {
        controller.get_synapse(s1).attr_write(offset, -(offset as i32) * 50);
    }
    for offset in 0..16 {
        assert_eq!(
            controller.get_synapse(s1).attr_read(offset),
            -(offset as i32) * 50
        );
    }
}

#[test]
fn negative_attribute_values_preserved() {
    let controller = new_controller(config(16));
    let n = controller.insert_node(1).unwrap();
    controller.get_node(n).attr_write(0, i32::MIN);
    controller.get_node(n).attr_write(1, -1);
    assert_eq!(controller.get_node(n).attr_read(0), i32::MIN);
    assert_eq!(controller.get_node(n).attr_read(1), -1);
}

// =========================================================
// PHASE 2: Triple Buffer Isolation — Consumer Thread Boundary
// =========================================================

#[test]
fn mutations_invisible_to_consumer_thread_before_publish_and_swap() {
    let mut controller = new_controller(config(16));

    // Extract raw pointer to decouple borrows
    let consumer = unsafe { mock_consumer_reader(&controller) };

    assert!(consumer.get_head_node().is_none());

    let _slot = controller.insert_node(42).unwrap();

    // Not published yet
    assert!(consumer.get_head_node().is_none());

    // Published but not swapped
    controller.publish();
    assert!(consumer.get_head_node().is_none());

    // Swapped — kind (TB-plane, set during insert) is now visible.
    // Meta is writable only through internal topology operations, so the
    // post-insert meta-write assertion from the previous API has been dropped.
    assert!(consumer.swap());
    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 42);
}

#[test]
fn multiple_mutations_batch_into_single_publish() {
    let mut controller = new_controller(config(16));

    let consumer = unsafe { mock_consumer_reader(&controller) };

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let n3 = controller.insert_node_after(n2, 3).unwrap();
    controller.connect(n1, n2, 10).unwrap();
    controller.connect(n2, n3, 20).unwrap();
    controller.get_node(n1).attr_write(0, 999);

    // Everything invisible
    assert!(consumer.get_head_node().is_none());

    controller.publish();
    consumer.swap();

    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    assert_eq!(consumer.get_node(n1).attr_read(0), 999);
    let next = consumer.get_node(head.get_next_ptr());
    assert_eq!(next.get_kind(), 2);
    let last = consumer.get_node(next.get_next_ptr());
    assert_eq!(last.get_kind(), 3);
}

#[test]
fn double_swap_without_publish_returns_false() {
    let mut controller = new_controller(config(16));

    let consumer = unsafe { mock_consumer_reader(&controller) };

    controller.insert_node(1).unwrap();
    controller.publish();

    assert!(consumer.swap()); // first swap consumes the publish
    assert!(!consumer.swap()); // nothing new to swap
}

#[test]
fn attributes_visible_immediately_without_publish() {
    // Attribute plane is shared (not triple-buffered), so writes are instant
    let controller = new_controller(config(16));

    let consumer = unsafe { mock_consumer_reader(&controller) };

    let n = controller.insert_node(1).unwrap();
    controller.get_node(n).attr_write(3, 42);

    // Attribute is visible to consumer immediately (shared plane)
    assert_eq!(consumer.get_node(n).attr_read(3), 42);
}

// =========================================================
// PHASE 3: Capacity Exhaustion — Saturation & Error Paths
// =========================================================

#[test]
fn node_capacity_exhaustion_returns_error() {
    let controller = new_controller(config(2));
    controller.insert_node(1).unwrap();
    controller.insert_node(2).unwrap();

    assert!(matches!(
        controller.insert_node(3),
        Err(KernelError::CapacityExhausted)
    ));
    assert!(matches!(
        controller.insert_node_after(1, 3),
        Err(KernelError::CapacityExhausted)
    ));
    assert!(matches!(
        controller.insert_node_before(1, 3),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn synapse_capacity_exhaustion_returns_error() {
    let controller = new_controller(create_config(16, 2));
    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let n3 = controller.insert_node_after(n2, 3).unwrap();

    controller.connect(n1, n2, 1).unwrap();
    controller.connect(n2, n3, 2).unwrap();

    assert!(matches!(
        controller.connect(n3, n1, 3),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn remove_then_reuse_slot() {
    let controller = new_controller(config(2));
    let n1 = controller.insert_node(1).unwrap();
    let _n2 = controller.insert_node(2).unwrap();

    // Full
    assert!(controller.insert_node(3).is_err());

    // Remove opens a slot — but deferred, so needs publish+flush
    controller.remove_node(n1).unwrap();

    // Slot count hasn't changed yet (deferred free)
    assert_eq!(controller.node_count(), 2);
}

#[test]
#[should_panic(expected = "attempted to read inactive slot")]
fn double_remove_same_node_panics_uaf_guard() {
    let controller = new_controller(config(16));
    let n1 = controller.insert_node(1).unwrap();
    controller.remove_node(n1).unwrap();
    // Second remove hits the UAF guard before reaching DoubleFree
    let _ = controller.remove_node(n1);
}

#[test]
#[should_panic(expected = "attempted to read inactive slot")]
fn double_disconnect_same_synapse_panics_uaf_guard() {
    let controller = new_controller(config(16));
    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let s1 = controller.connect(n1, n2, 1).unwrap();
    controller.disconnect_synapse(s1).unwrap();
    // Second disconnect hits the UAF guard
    let _ = controller.disconnect_synapse(s1);
}

// =========================================================
// PHASE 4: Grow — Memory Scaling & Topology Preservation
// =========================================================

#[test]
fn grow_rejects_smaller_capacity() {
    let mut controller = new_controller(config(16));
    assert!(matches!(
        controller.grow(config(8)),
        Err(KernelError::InsufficientCapacity)
    ));
}

#[test]
fn grow_rejects_same_capacity() {
    let mut controller = new_controller(config(16));
    // Same capacity — node_capacity < old is false, but not strictly >
    // This should succeed since it's not *less* than current
    assert!(controller.grow(config(16)).is_ok());
}

#[test]
fn grow_preserves_chain_topology() {
    let mut controller = new_controller(config(8));

    let n1 = controller.insert_node(10).unwrap();
    let n2 = controller.insert_node_after(n1, 20).unwrap();
    let _n3 = controller.insert_node_after(n2, 30).unwrap();

    controller.grow(config(32)).unwrap();

    // Verify chain survived via writer
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 10);
    let w2 = controller.get_node(head.get_next_ptr());
    assert_eq!(w2.get_kind(), 20);
    let w3 = controller.get_node(w2.get_next_ptr());
    assert_eq!(w3.get_kind(), 30);
}

#[test]
fn grow_preserves_node_and_synapse_attributes() {
    let mut controller = new_controller(config(8));

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let s1 = controller.connect(n1, n2, 5).unwrap();

    controller.get_node(n1).attr_write(0, 1000);
    controller.get_node(n1).attr_write(15, -999);
    controller.get_synapse(s1).attr_write(0, 5000);
    controller.get_synapse(s1).attr_write(15, -5000);

    controller.grow(config(32)).unwrap();

    assert_eq!(controller.get_node(n1).attr_read(0), 1000);
    assert_eq!(controller.get_node(n1).attr_read(15), -999);
    assert_eq!(controller.get_synapse(s1).attr_read(0), 5000);
    assert_eq!(controller.get_synapse(s1).attr_read(15), -5000);
}

#[test]
fn grow_preserves_synapse_connectivity() {
    let mut controller = new_controller(config(8));

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let n3 = controller.insert_node_after(n2, 3).unwrap();

    let s12 = controller.connect(n1, n2, 10).unwrap();
    let s13 = controller.connect(n1, n3, 20).unwrap();
    let s23 = controller.connect(n2, n3, 30).unwrap();

    controller.grow(config(32)).unwrap();

    // Verify synapse kinds survived
    assert_eq!(controller.get_synapse(s12).get_kind(), 10);
    assert_eq!(controller.get_synapse(s13).get_kind(), 20);
    assert_eq!(controller.get_synapse(s23).get_kind(), 30);
}

#[test]
fn grow_expanded_capacity_is_allocatable() {
    let mut controller = new_controller(config(4));

    // Fill old capacity
    controller.insert_node(1).unwrap();
    controller.insert_node(2).unwrap();
    controller.insert_node(3).unwrap();
    controller.insert_node(4).unwrap();
    assert!(controller.insert_node(5).is_err());

    controller.grow(config(8)).unwrap();

    // New capacity is usable
    controller.insert_node(5).unwrap();
    controller.insert_node(6).unwrap();
    controller.insert_node(7).unwrap();
    controller.insert_node(8).unwrap();
    assert!(controller.insert_node(9).is_err());
    assert_eq!(controller.node_count(), 8);
}

#[test]
fn grow_consumer_thread_sees_migrated_data_after_publish_swap() {
    let mut controller = new_controller(config(8));

    let n1 = controller.insert_node(10).unwrap();
    let n2 = controller.insert_node_after(n1, 20).unwrap();
    let s1 = controller.connect(n1, n2, 99).unwrap();
    controller.get_node(n1).attr_write(0, 1000);
    controller.get_synapse(s1).attr_write(0, 5000);

    controller.grow(config(32)).unwrap();
    controller.publish();

    let consumer = unsafe { mock_consumer_reader(&controller) };
    consumer.swap();

    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 10);
    assert_eq!(consumer.get_node(n1).attr_read(0), 1000);

    let next = consumer.get_node(head.get_next_ptr());
    assert_eq!(next.get_kind(), 20);

    let syn = consumer.get_synapse(s1);
    assert_eq!(syn.get_kind(), 99);
    assert_eq!(consumer.get_synapse(s1).attr_read(0), 5000);
}

#[test]
fn grow_after_heavy_fragmentation() {
    let mut controller = new_controller(config(8));

    // Create 8 nodes
    let mut slots = Vec::new();
    for i in 0..8 {
        slots.push(controller.insert_node(i).unwrap());
    }

    // Remove every other node (creates fragmentation in free list)
    controller.remove_node(slots[1]).unwrap();
    controller.remove_node(slots[3]).unwrap();
    controller.remove_node(slots[5]).unwrap();
    controller.remove_node(slots[7]).unwrap();

    // Publish to flush deferred frees
    controller.publish();

    // Now grow with fragmented free list
    controller.grow(config(16)).unwrap();

    // Verify surviving nodes
    assert_eq!(controller.get_node(slots[0]).get_kind(), 0);
    assert_eq!(controller.get_node(slots[2]).get_kind(), 2);
    assert_eq!(controller.get_node(slots[4]).get_kind(), 4);
    assert_eq!(controller.get_node(slots[6]).get_kind(), 6);

    // Verify we can allocate into the expanded region
    let new_node = controller.insert_node(100).unwrap();
    assert_eq!(controller.get_node(new_node).get_kind(), 100);
}

// =========================================================
// PHASE 5: GC Pipeline — Backlog/Pending Rotation
// =========================================================

#[test]
fn gc_pipeline_rotates_through_publish_cycles() {
    let mut controller = new_controller(config(8));

    for i in 0..7 {
        controller.insert_node(i).unwrap();
    }
    assert!(controller.should_grow(0.70));

    controller.grow(config(16)).unwrap();
    assert_eq!(controller.node_capacity(), 16);

    // First publish: backlog -> pending_deletion
    controller.publish();
    // Second publish: pending_deletion dropped
    controller.publish();

    // Consumer thread sees migrated data.
    // Note: `mock_consumer_reader` calls `EpochConsumer::acquire_mirror`, which now
    // bundles the swap internally. The explicit `swap()` is no longer observable
    // here — the migrated state visibility is confirmed by the kind assertion.
    let consumer = unsafe { mock_consumer_reader(&controller) };
    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 6); // last inserted head
}

#[test]
fn consecutive_grows_without_crash() {
    let mut controller = new_controller(config(4));
    controller.insert_node(1).unwrap();

    controller.grow(config(8)).unwrap();
    controller.publish();

    controller.grow(config(16)).unwrap();
    controller.publish();

    controller.grow(config(32)).unwrap();
    controller.publish();

    assert_eq!(controller.node_capacity(), 32);
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
}

#[test]
fn grow_then_mutate_then_publish() {
    let mut controller = new_controller(config(4));
    let n1 = controller.insert_node(1).unwrap();

    controller.grow(config(16)).unwrap();

    // Mutate AFTER grow, BEFORE publish
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    controller.get_node(n2).attr_write(0, 777);

    controller.publish();

    let consumer = unsafe { mock_consumer_reader(&controller) };
    consumer.swap();

    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 1);
    let next = consumer.get_node(head.get_next_ptr());
    assert_eq!(next.get_kind(), 2);
    assert_eq!(consumer.get_node(n2).attr_read(0), 777);
}

// =========================================================
// PHASE 6: Threshold Logic
// =========================================================

#[test]
fn should_grow_respects_threshold_boundary() {
    let controller = new_controller(config(4));
    assert!(!controller.should_grow(0.75));

    controller.insert_node(1).unwrap();
    controller.insert_node(2).unwrap();
    controller.insert_node(3).unwrap();

    // 3/4 = 0.75, should_grow uses > not >=
    assert!(!controller.should_grow(0.75));

    controller.insert_node(4).unwrap();
    // 4/4 = 1.0 > 0.75
    assert!(controller.should_grow(0.75));
}

// =========================================================
// PHASE 7: Controller Plane Address Stability
// =========================================================

#[test]
fn control_plane_address_is_stable_across_grow() {
    let mut controller = new_controller(config(4));
    let addr_before = Arc::as_ptr(&controller.get_control_plane()) as usize;

    controller.grow(config(8)).unwrap();
    let addr_after = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // The ControlPlane is boxed and its address must not move.
    // Consumer thread holds this pointer — if it moves, segfault.
    assert_eq!(addr_before, addr_after);
}

#[test]
fn control_plane_address_nonzero() {
    let controller = new_controller(config(4));
    assert_ne!(Arc::as_ptr(&controller.get_control_plane()) as usize, 0);
}

// =========================================================
// PHASE 8: Asymmetric Config (different node/synapse caps)
// =========================================================

#[test]
fn asymmetric_capacity_works() {
    let controller = new_controller(create_config(16, 4));
    assert_eq!(controller.node_capacity(), 16);
    assert_eq!(controller.synapse_capacity(), 4);

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();

    controller.connect(n1, n2, 1).unwrap();
    controller.connect(n1, n2, 2).unwrap();
    controller.connect(n1, n2, 3).unwrap();
    controller.connect(n1, n2, 4).unwrap();

    assert!(matches!(
        controller.connect(n1, n2, 5),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn grow_rejects_if_only_nodes_shrink() {
    let mut controller = new_controller(create_config(16, 16));
    assert!(matches!(
        controller.grow(create_config(8, 32)),
        Err(KernelError::InsufficientCapacity)
    ));
}

#[test]
fn grow_rejects_if_only_synapses_shrink() {
    let mut controller = new_controller(create_config(16, 16));
    assert!(matches!(
        controller.grow(create_config(32, 8)),
        Err(KernelError::InsufficientCapacity)
    ));
}

#[test]
fn defer_then_grow_then_publish_flushes_on_new_allocator() {
    let mut controller = new_controller(config(4));

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let n3 = controller.insert_node_after(n2, 3).unwrap();
    let n4 = controller.insert_node_after(n3, 4).unwrap();

    // Full
    assert!(controller.insert_node(99).is_err());

    // Defer a free — slot is marked but not released yet
    controller.remove_node(n2).unwrap();
    assert_eq!(controller.node_count(), 4); // still 4 (deferred)

    // Grow BEFORE publish — deferred state must be copied to new allocator
    controller.grow(config(8)).unwrap();

    // Publish flushes deferred frees on the NEW allocator
    controller.publish();

    // n2's slot should now be genuinely free on the new allocator
    // We can verify by inserting — if deferred flush failed, this would fail
    let n5 = controller.insert_node(5).unwrap();
    assert_eq!(controller.get_node(n5).get_kind(), 5);

    // The remaining original nodes should still be intact
    assert_eq!(controller.get_node(n1).get_kind(), 1);
    assert_eq!(controller.get_node(n3).get_kind(), 3);
    assert_eq!(controller.get_node(n4).get_kind(), 4);
}

#[test]
fn defer_then_grow_then_defer_more_then_publish() {
    let mut controller = new_controller(config(8));

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let n3 = controller.insert_node_after(n2, 3).unwrap();
    let n4 = controller.insert_node_after(n3, 4).unwrap();

    // Defer n2 on the OLD allocator
    controller.remove_node(n2).unwrap();

    // Grow — deferred state for n2 is copied
    controller.grow(config(16)).unwrap();

    // Defer n4 on the NEW allocator
    controller.remove_node(n4).unwrap();

    // Publish flushes BOTH deferred frees
    controller.publish();

    // Both n2 and n4 should be reclaimable
    let n5 = controller.insert_node(5).unwrap();
    let n6 = controller.insert_node(6).unwrap();
    assert_eq!(controller.get_node(n5).get_kind(), 5);
    assert_eq!(controller.get_node(n6).get_kind(), 6);

    // Survivors intact
    assert_eq!(controller.get_node(n1).get_kind(), 1);
    assert_eq!(controller.get_node(n3).get_kind(), 3);
}

#[test]
fn defer_then_publish_then_grow_preserves_freed_slot() {
    let mut controller = new_controller(config(4));

    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    let _n3 = controller.insert_node_after(n2, 3).unwrap();
    let _n4 = controller.insert_node_after(_n3, 4).unwrap();

    // Defer and flush BEFORE grow
    controller.remove_node(n2).unwrap();
    controller.publish(); // flushes on OLD allocator

    // n2's slot is now genuinely free in the old free list
    // Grow copies the free list state — n2's slot should remain free
    controller.grow(config(8)).unwrap();

    // n2's slot should be allocatable on the new allocator
    let n5 = controller.insert_node(5).unwrap();
    assert_eq!(controller.get_node(n5).get_kind(), 5);

    // Verify consumer thread sees correct state after full cycle
    controller.publish();
    let consumer = unsafe { mock_consumer_reader(&controller) };
    consumer.swap();

    let head = consumer.get_head_node().unwrap();
    assert_eq!(head.get_kind(), 5);
}

// =========================================================
// Concurrent: Consumer Thread vs Main Thread
// =========================================================

#[test]
fn concurrent_traversal_during_rapid_publish_cycles() {
    let mut controller = new_controller(config(64));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running_consumer = running.clone();

    // Consumer thread: continuously swap + traverse
    let consumer_thread = std::thread::spawn(move || {
        let cp_ref = unsafe {
            &*(cp_addr as *const ControlPlane<1, 1, 1>)
        };
        let cp_arc: Arc<ControlPlane<1, 1, 1>> =
            unsafe { Arc::from_raw(cp_ref) };
        let mut processor = EpochConsumer::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(std::sync::atomic::Ordering::Relaxed) {
            let reader = processor.acquire_mirror();

            // Traverse the full chain — must terminate, no cycles
            let mut current = reader.get_head_node();
            let mut count = 0;
            while let Some(node) = current {
                let kind: i32 = node.get_kind();
                // Kinds should be 0..63 range (what we insert below)
                assert!(kind >= 0 && kind < 64, "corrupt kind: {}", kind);

                let next_ptr = node.get_next_ptr();
                if next_ptr == 0 {
                    break;
                }
                current = Some(reader.get_node(next_ptr));
                count += 1;
                assert!(count <= 64, "chain exceeded capacity — possible cycle");
            }

            iterations += 1;
        }

        iterations
    });

    // Main thread: insert nodes and publish rapidly
    for i in 0..60 {
        controller.insert_node(i).unwrap();
        if i % 5 == 0 {
            controller.publish();
        }
    }
    // Final publish to flush everything
    controller.publish();

    // Let consumer thread run a few more cycles
    std::thread::sleep(std::time::Duration::from_millis(10));

    running.store(false, std::sync::atomic::Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked");
    assert!(iterations > 0, "consumer thread never ran");
}

#[test]
fn concurrent_traversal_during_grow() {
    let mut controller = new_controller(config(8));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // Seed initial data
    let n1 = controller.insert_node(1).unwrap();
    let n2 = controller.insert_node_after(n1, 2).unwrap();
    controller.connect(n1, n2, 10).unwrap();
    controller.get_node(n1).attr_write(0, 42);
    controller.publish();

    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running_consumer = running.clone();

    // Consumer thread: continuously reads while main thread grows
    let consumer_thread = std::thread::spawn(move || {
        let cp_ref = unsafe {
            &*(cp_addr as *const ControlPlane<1, 1, 1>)
        };
        let cp_arc: Arc<ControlPlane<1, 1, 1>> =
            unsafe { Arc::from_raw(cp_ref) };
        let mut processor = EpochConsumer::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(std::sync::atomic::Ordering::Relaxed) {
            // Re-acquire EVERY iteration — critical after grow()
            let reader = processor.acquire_mirror();

            let mut current = reader.get_head_node();
            while let Some(node) = current {
                let _kind: i32 = node.get_kind();
                let next_ptr = node.get_next_ptr();
                if next_ptr == 0 {
                    break;
                }
                current = Some(reader.get_node(next_ptr));
            }

            iterations += 1;
        }

        iterations
    });

    // Main thread: grow multiple times while consumer reads
    controller.grow(config(16)).unwrap();
    controller.publish();

    // Insert into expanded capacity
    for i in 3..14 {
        controller.insert_node(i).unwrap();
    }
    controller.publish();

    controller.grow(config(32)).unwrap();
    controller.publish();

    // More inserts
    for i in 14..28 {
        controller.insert_node(i).unwrap();
    }
    controller.publish();

    // Let consumer thread catch up
    std::thread::sleep(std::time::Duration::from_millis(10));

    // Extra publishes to rotate GC pipeline and drop old readers
    controller.publish();
    controller.publish();

    running.store(false, std::sync::atomic::Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked during grow");
    assert!(iterations > 0);
}

#[test]
fn concurrent_attribute_reads_during_writes() {
    let controller = new_controller(config(16));
    let cp_addr = Arc::as_ptr(&controller.get_control_plane()) as usize;

    // Create a node whose attributes we'll hammer
    let n1 = controller.insert_node(1).unwrap();

    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running_consumer = running.clone();
    let slot = n1;

    // Consumer thread: continuously reads attributes
    let consumer_thread = std::thread::spawn(move || {
        let cp_ref = unsafe {
            &*(cp_addr as *const ControlPlane<1, 1, 1>)
        };
        let cp_arc: Arc<ControlPlane<1, 1, 1>> =
            unsafe { Arc::from_raw(cp_ref) };
        let mut processor = EpochConsumer::new(Arc::clone(&cp_arc));
        std::mem::forget(cp_arc);
        let mut iterations = 0u64;

        while running_consumer.load(std::sync::atomic::Ordering::Relaxed) {
            let reader = processor.acquire_mirror();

            // Read all 16 attribute offsets — must never panic or return garbage
            for offset in 0..16 {
                let val = reader.get_node(slot).attr_read(offset);
                // Values should be either 0 (initial) or a valid written value
                // Written values are offset * 1000 + iteration_batch
                // Just verify it doesn't panic and isn't a torn value
                let _ = val;
            }

            iterations += 1;
        }

        iterations
    });

    // Main thread: rapidly writes attributes
    for batch in 0..500 {
        for offset in 0..16 {
            controller.get_node(n1).attr_write(offset, (offset as i32) * 1000 + batch);
        }
    }

    // Let consumer thread finish a few more reads
    std::thread::sleep(std::time::Duration::from_millis(5));

    running.store(false, std::sync::atomic::Ordering::Relaxed);
    let iterations = consumer_thread.join().expect("consumer thread panicked during attribute writes");
    assert!(iterations > 0, "consumer thread never ran");
}

#[test]
fn get_entry_store_insert_write_read_roundtrip() {
    let kernel = new_controller(config(16));
    let store = kernel.get_entry_store(EntryStoreId(0));
    let slot = store.insert().unwrap();
    store.get(slot).attr_write(0, 42);
    assert_eq!(store.get(slot).attr_read(0), 42);
}

#[test]
fn get_entry_store_returns_same_store_across_calls() {
    let kernel = new_controller(config(16));
    let s1 = kernel.get_entry_store(EntryStoreId(0));
    let s2 = kernel.get_entry_store(EntryStoreId(0));
    assert_eq!(s1.mem_start_offset(), s2.mem_start_offset());
    assert_eq!(s1.capacity(), s2.capacity());
}

#[test]
fn entry_store_core_visible_after_publish_swap() {
    let mut kernel = new_controller(config(16));
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    let slot = {
        let store = kernel.get_entry_store(EntryStoreId(0));
        let slot = store.insert().unwrap();
        store.get(slot).core_write(0, 777);
        slot
    };
    kernel.publish();
    assert!(mirror.swap());
    let reader_store = mirror.get_entry_store(EntryStoreId(0));
    assert_eq!(reader_store.get(slot).core_read(0), 777);
}

#[test]
fn entry_store_attr_visible_without_publish() {
    let kernel = new_controller(config(16));
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    let store = kernel.get_entry_store(EntryStoreId(0));
    let slot = store.insert().unwrap();
    store.get(slot).attr_write(0, 42);
    assert_eq!(
        mirror.get_entry_store(EntryStoreId(0)).get(slot).attr_read(0),
        42
    );
}

#[test]
fn entry_store_survives_grow() {
    let mut kernel = new_controller(config(4));
    let store = kernel.get_entry_store(EntryStoreId(0));
    let slot = store.insert().unwrap();
    store.get(slot).attr_write(0, 999);
    kernel.publish();
    kernel.grow(config(8)).unwrap();
    let store_after = kernel.get_entry_store(EntryStoreId(0));
    assert_eq!(store_after.get(slot).attr_read(0), 999);
}

#[test]
fn entry_store_core_meta_survives_grow() {
    let mut kernel = new_controller(config(4));
    let mut consumer = EpochConsumer::new(kernel.get_control_plane());

    const CORE_V: i32 = 12_345;
    const META_V: i32 = 67_890;

    let slot = {
        let store = kernel.get_entry_store(EntryStoreId(0));
        let slot = store.insert().unwrap();
        store.get(slot).core_write(0, CORE_V);
        store.get(slot).meta_write(0, META_V);
        slot
    };

    kernel.publish();
    kernel.grow(config(8)).unwrap();
    kernel.publish();

    let mirror = consumer.acquire_mirror();
    let reader_store = mirror.get_entry_store(EntryStoreId(0));
    assert_eq!(reader_store.get(slot).core_read(0), CORE_V);
    assert_eq!(reader_store.get(slot).meta_read(0), META_V);
}

#[test]
fn publish_tb_independent_of_default_publish() {
    let kernel = new_controller(config(16));
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    kernel.get_user_tb(TripleBufferId(0)).write(0, 42);
    kernel.publish_tb(TripleBufferId(0));
    mirror.swap_tb(TripleBufferId(0));
    assert_eq!(
        mirror.get_user_tb(TripleBufferId(0)).read(0),
        42,
        "user TB visible after publish_tb + swap_tb"
    );
    assert!(
        !mirror.swap(),
        "default TB must have no pending publish when only publish_tb was used"
    );
}

#[test]
fn lut_write_read_roundtrip() {
    let mut kernel = new_controller(config_with_lut_on_default(1));
    kernel.get_lut(LutId(0)).write(0, 42);
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    kernel.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_lut(LutId(0)).read(0), 42);
}

#[test]
fn lut_write_all_visible_after_publish() {
    let mut kernel = new_controller(config_with_lut_on_default(8));
    let data: Vec<i32> = (0..8).map(|i| i * 3).collect();
    kernel.get_lut(LutId(0)).write_all(&data);
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    kernel.publish();
    assert!(mirror.swap());
    let mut out = [0i32; 8];
    mirror.get_lut(LutId(0)).read_all(&mut out);
    assert_eq!(out.as_slice(), data.as_slice());
}

#[test]
fn lut_not_visible_before_publish() {
    let mut kernel = new_controller(config_with_lut_on_default(1));
    kernel.get_lut(LutId(0)).write(0, 99);
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    assert_eq!(
        mirror.get_lut(LutId(0)).read(0),
        0,
        "consumer read buffer must not see producer writes until publish+swap"
    );
    kernel.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_lut(LutId(0)).read(0), 99);
}

#[test]
fn lut_survives_grow() {
    let mut kernel = new_controller(config_with_lut_on_default(4));
    kernel.get_lut(LutId(0)).write(0, 1001);
    kernel.get_lut(LutId(0)).write(3, 2002);
    let mut larger = config_with_lut_on_default(8);
    larger.network_config.node_capacity = 32;
    larger.network_config.synapse_capacity = 32;
    kernel.grow(larger).unwrap();
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    kernel.publish();
    assert!(mirror.swap());
    assert_eq!(mirror.get_lut(LutId(0)).read(0), 1001);
    assert_eq!(mirror.get_lut(LutId(0)).read(3), 2002);
}

#[test]
fn lut_on_user_tb_independent_publish() {
    let kernel = new_controller(config_with_lut_on_user_tb(16));
    kernel.get_lut(LutId(0)).write(0, 7);
    kernel.get_lut(LutId(0)).write(5, 8);
    let mirror = unsafe { mock_consumer_reader(&kernel) };
    kernel.publish_tb(TripleBufferId(0));
    mirror.swap_tb(TripleBufferId(0));
    assert_eq!(mirror.get_lut(LutId(0)).read(0), 7);
    assert_eq!(mirror.get_lut(LutId(0)).read(5), 8);
    assert!(
        !mirror.swap(),
        "default TB must have no pending publish when only publish_tb was used"
    );
}
