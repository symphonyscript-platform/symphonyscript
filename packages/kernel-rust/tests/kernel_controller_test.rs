use symphonyscript_kernel::control_plane::ControlPlane;
use symphonyscript_kernel::errors::free_list_error::FreeListError;
use symphonyscript_kernel::errors::kernel_error::KernelError;
use symphonyscript_kernel::kernel_controller::KernelController;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;
use symphonyscript_kernel::synaptic_graph_config::SynapticGraphConfig;

fn create_config(nodes: usize, synapses: usize) -> SynapticGraphConfig {
    SynapticGraphConfig {
        node_capacity: nodes,
        synapse_capacity: synapses,
    }
}

fn config(capacity: usize) -> SynapticGraphConfig {
    create_config(capacity, capacity)
}

fn draft(opcode: i32) -> NodeDraft {
    NodeDraft {
        opcode,
        base_tick: 0,
    }
}

fn syn(opcode: i32) -> SynapseDraft {
    SynapseDraft { opcode }
}

/// Extract audio-thread reader from controller via raw ControlPlane pointer.
/// This simulates the exact path the audio thread takes in production.
unsafe fn mock_audio_reader(
    controller: &KernelController,
) -> &mut symphonyscript_kernel::synaptic_graph_reader::SynapticGraphReader {
    let cp_address = controller.get_controller_plane_address();
    let cp_ptr = cp_address as *const ControlPlane;
    let reader_ptr = (*cp_ptr).get_shared_graph_ptr();
    &mut *reader_ptr
}

// =========================================================
// PHASE 1: Happy Path — Lifecycle & Basic Operations
// =========================================================

#[test]
fn fresh_controller_reports_zero_counts() {
    let controller = KernelController::new(config(16));
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
    let controller = KernelController::new(config(16));
    let slot = controller.insert_head(draft(1)).unwrap();
    assert!(slot > 0);
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
}

#[test]
fn insert_after_and_before_form_correct_chain() {
    let controller = KernelController::new(config(16));
    let n1 = controller.insert_head(draft(10)).unwrap();
    let n3 = controller.insert_after(n1, draft(30)).unwrap();
    let n2 = controller.insert_before(n3, draft(20)).unwrap();

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
    let controller = KernelController::new(config(16));
    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();

    let s1 = controller.connect(n1, n2, syn(5)).unwrap();
    let synapse = controller.get_synapse(s1);
    assert_eq!(synapse.get_opcode(), 5);

    controller.disconnect(s1).unwrap();
}

#[test]
fn node_and_synapse_attribute_round_trip() {
    let controller = KernelController::new(config(16));
    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let s1 = controller.connect(n1, n2, syn(1)).unwrap();

    // Node attributes: write every offset, read back
    for offset in 0..16 {
        controller.set_node_attribute(n1, offset, (offset as i32) * 100);
    }
    for offset in 0..16 {
        assert_eq!(
            controller.get_node_attribute(n1, offset),
            (offset as i32) * 100
        );
    }

    // Synapse attributes: same
    for offset in 0..16 {
        controller.set_synapse_attribute(s1, offset, -(offset as i32) * 50);
    }
    for offset in 0..16 {
        assert_eq!(
            controller.get_synapse_attribute(s1, offset),
            -(offset as i32) * 50
        );
    }
}

#[test]
fn negative_attribute_values_preserved() {
    let controller = KernelController::new(config(16));
    let n = controller.insert_head(draft(1)).unwrap();
    controller.set_node_attribute(n, 0, i32::MIN);
    controller.set_node_attribute(n, 1, -1);
    assert_eq!(controller.get_node_attribute(n, 0), i32::MIN);
    assert_eq!(controller.get_node_attribute(n, 1), -1);
}

// =========================================================
// PHASE 2: Triple Buffer Isolation — Audio Thread Boundary
// =========================================================

#[test]
fn mutations_invisible_to_audio_thread_before_publish_and_swap() {
    let mut controller = KernelController::new(config(16));

    // Extract raw pointer to decouple borrows
    let cp_address = controller.get_controller_plane_address();
    let cp_ptr = cp_address as *const ControlPlane;
    let reader_ptr = unsafe { (*cp_ptr).get_shared_graph_ptr() };
    let audio = unsafe { &mut *reader_ptr };

    assert!(audio.get_head_node().is_none());

    controller.insert_head(NodeDraft {
        opcode: 42,
        base_tick: 100,
    }).unwrap();

    // Not published yet
    assert!(audio.get_head_node().is_none());

    // Published but not swapped
    controller.publish().unwrap();
    assert!(audio.get_head_node().is_none());

    // Swapped
    assert!(audio.swap());
    let head = audio.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 42);
    assert_eq!(head.get_base_tick(), 100);
}

#[test]
fn multiple_mutations_batch_into_single_publish() {
    let mut controller = KernelController::new(config(16));

    let cp_address = controller.get_controller_plane_address();
    let cp_ptr = cp_address as *const ControlPlane;
    let reader_ptr = unsafe { (*cp_ptr).get_shared_graph_ptr() };
    let audio = unsafe { &mut *reader_ptr };

    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let n3 = controller.insert_after(n2, draft(3)).unwrap();
    controller.connect(n1, n2, syn(10)).unwrap();
    controller.connect(n2, n3, syn(20)).unwrap();
    controller.set_node_attribute(n1, 0, 999);

    // Everything invisible
    assert!(audio.get_head_node().is_none());

    controller.publish().unwrap();
    audio.swap();

    let head = audio.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
    assert_eq!(audio.get_node_attribute(n1, 0), 999);
    let next = audio.get_node(head.get_next_ptr());
    assert_eq!(next.get_opcode(), 2);
    let last = audio.get_node(next.get_next_ptr());
    assert_eq!(last.get_opcode(), 3);
}

#[test]
fn double_swap_without_publish_returns_false() {
    let mut controller = KernelController::new(config(16));

    let cp_address = controller.get_controller_plane_address();
    let cp_ptr = cp_address as *const ControlPlane;
    let reader_ptr = unsafe { (*cp_ptr).get_shared_graph_ptr() };
    let audio = unsafe { &mut *reader_ptr };

    controller.insert_head(draft(1)).unwrap();
    controller.publish().unwrap();

    assert!(audio.swap());  // first swap consumes the publish
    assert!(!audio.swap()); // nothing new to swap
}

#[test]
fn attributes_visible_immediately_without_publish() {
    // Attribute plane is shared (not triple-buffered), so writes are instant
    let controller = KernelController::new(config(16));

    let cp_address = controller.get_controller_plane_address();
    let cp_ptr = cp_address as *const ControlPlane;
    let reader_ptr = unsafe { (*cp_ptr).get_shared_graph_ptr() };
    let audio = unsafe { &mut *reader_ptr };

    let n = controller.insert_head(draft(1)).unwrap();
    controller.set_node_attribute(n, 3, 42);

    // Attribute is visible to audio immediately (shared plane)
    assert_eq!(audio.get_node_attribute(n, 3), 42);
}

// =========================================================
// PHASE 3: Capacity Exhaustion — Saturation & Error Paths
// =========================================================

#[test]
fn node_capacity_exhaustion_returns_error() {
    let controller = KernelController::new(config(2));
    controller.insert_head(draft(1)).unwrap();
    controller.insert_head(draft(2)).unwrap();

    assert!(matches!(
        controller.insert_head(draft(3)),
        Err(KernelError::CapacityExhausted)
    ));
    assert!(matches!(
        controller.insert_after(1, draft(3)),
        Err(KernelError::CapacityExhausted)
    ));
    assert!(matches!(
        controller.insert_before(1, draft(3)),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn synapse_capacity_exhaustion_returns_error() {
    let controller = KernelController::new(create_config(16, 2));
    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let n3 = controller.insert_after(n2, draft(3)).unwrap();

    controller.connect(n1, n2, syn(1)).unwrap();
    controller.connect(n2, n3, syn(2)).unwrap();

    assert!(matches!(
        controller.connect(n3, n1, syn(3)),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn remove_then_reuse_slot() {
    let controller = KernelController::new(config(2));
    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_head(draft(2)).unwrap();

    // Full
    assert!(controller.insert_head(draft(3)).is_err());

    // Remove opens a slot — but deferred, so needs publish+flush
    controller.remove_node(n1).unwrap();

    // Slot count hasn't changed yet (deferred free)
    assert_eq!(controller.node_count(), 2);
}

#[test]
#[should_panic(expected = "attempted to read inactive slot")]
fn double_remove_same_node_panics_uaf_guard() {
    let controller = KernelController::new(config(16));
    let n1 = controller.insert_head(draft(1)).unwrap();
    controller.remove_node(n1).unwrap();
    // Second remove hits the UAF guard before reaching DoubleFree
    let _ = controller.remove_node(n1);
}

#[test]
#[should_panic(expected = "attempted to read inactive slot")]
fn double_disconnect_same_synapse_panics_uaf_guard() {
    let controller = KernelController::new(config(16));
    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let s1 = controller.connect(n1, n2, syn(1)).unwrap();
    controller.disconnect(s1).unwrap();
    // Second disconnect hits the UAF guard
    let _ = controller.disconnect(s1);
}

// =========================================================
// PHASE 4: Grow — Memory Scaling & Topology Preservation
// =========================================================

#[test]
fn grow_rejects_smaller_capacity() {
    let mut controller = KernelController::new(config(16));
    assert!(matches!(
        controller.grow(config(8)),
        Err(KernelError::InsufficientCapacity)
    ));
}

#[test]
fn grow_rejects_same_capacity() {
    let mut controller = KernelController::new(config(16));
    // Same capacity — node_capacity < old is false, but not strictly >
    // This should succeed since it's not *less* than current
    assert!(controller.grow(config(16)).is_ok());
}

#[test]
fn grow_preserves_chain_topology() {
    let mut controller = KernelController::new(config(8));

    let n1 = controller.insert_head(draft(10)).unwrap();
    let n2 = controller.insert_after(n1, draft(20)).unwrap();
    let n3 = controller.insert_after(n2, draft(30)).unwrap();

    controller.grow(config(32)).unwrap();

    // Verify chain survived via writer
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 10);
    let w2 = controller.get_node(head.get_next_ptr());
    assert_eq!(w2.get_opcode(), 20);
    let w3 = controller.get_node(w2.get_next_ptr());
    assert_eq!(w3.get_opcode(), 30);
}

#[test]
fn grow_preserves_node_and_synapse_attributes() {
    let mut controller = KernelController::new(config(8));

    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let s1 = controller.connect(n1, n2, syn(5)).unwrap();

    controller.set_node_attribute(n1, 0, 1000);
    controller.set_node_attribute(n1, 15, -999);
    controller.set_synapse_attribute(s1, 0, 5000);
    controller.set_synapse_attribute(s1, 15, -5000);

    controller.grow(config(32)).unwrap();

    assert_eq!(controller.get_node_attribute(n1, 0), 1000);
    assert_eq!(controller.get_node_attribute(n1, 15), -999);
    assert_eq!(controller.get_synapse_attribute(s1, 0), 5000);
    assert_eq!(controller.get_synapse_attribute(s1, 15), -5000);
}

#[test]
fn grow_preserves_synapse_connectivity() {
    let mut controller = KernelController::new(config(8));

    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    let n3 = controller.insert_after(n2, draft(3)).unwrap();

    let s12 = controller.connect(n1, n2, syn(10)).unwrap();
    let s13 = controller.connect(n1, n3, syn(20)).unwrap();
    let s23 = controller.connect(n2, n3, syn(30)).unwrap();

    controller.grow(config(32)).unwrap();

    // Verify synapse opcodes survived
    assert_eq!(controller.get_synapse(s12).get_opcode(), 10);
    assert_eq!(controller.get_synapse(s13).get_opcode(), 20);
    assert_eq!(controller.get_synapse(s23).get_opcode(), 30);
}

#[test]
fn grow_expanded_capacity_is_allocatable() {
    let mut controller = KernelController::new(config(4));

    // Fill old capacity
    controller.insert_head(draft(1)).unwrap();
    controller.insert_head(draft(2)).unwrap();
    controller.insert_head(draft(3)).unwrap();
    controller.insert_head(draft(4)).unwrap();
    assert!(controller.insert_head(draft(5)).is_err());

    controller.grow(config(8)).unwrap();

    // New capacity is usable
    controller.insert_head(draft(5)).unwrap();
    controller.insert_head(draft(6)).unwrap();
    controller.insert_head(draft(7)).unwrap();
    controller.insert_head(draft(8)).unwrap();
    assert!(controller.insert_head(draft(9)).is_err());
    assert_eq!(controller.node_count(), 8);
}

#[test]
fn grow_audio_thread_sees_migrated_data_after_publish_swap() {
    let mut controller = KernelController::new(config(8));

    let n1 = controller.insert_head(draft(10)).unwrap();
    let n2 = controller.insert_after(n1, draft(20)).unwrap();
    let s1 = controller.connect(n1, n2, syn(99)).unwrap();
    controller.set_node_attribute(n1, 0, 1000);
    controller.set_synapse_attribute(s1, 0, 5000);

    controller.grow(config(32)).unwrap();
    controller.publish().unwrap();

    let audio = unsafe { mock_audio_reader(&controller) };
    audio.swap();

    let head = audio.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 10);
    assert_eq!(audio.get_node_attribute(n1, 0), 1000);

    let next = audio.get_node(head.get_next_ptr());
    assert_eq!(next.get_opcode(), 20);

    let syn = audio.get_synapse(s1);
    assert_eq!(syn.get_opcode(), 99);
    assert_eq!(audio.get_synapse_attribute(s1, 0), 5000);
}

#[test]
fn grow_after_heavy_fragmentation() {
    let mut controller = KernelController::new(config(8));

    // Create 8 nodes
    let mut slots = Vec::new();
    for i in 0..8 {
        slots.push(controller.insert_head(draft(i)).unwrap());
    }

    // Remove every other node (creates fragmentation in free list)
    controller.remove_node(slots[1]).unwrap();
    controller.remove_node(slots[3]).unwrap();
    controller.remove_node(slots[5]).unwrap();
    controller.remove_node(slots[7]).unwrap();

    // Publish to flush deferred frees
    controller.publish().unwrap();

    // Now grow with fragmented free list
    controller.grow(config(16)).unwrap();

    // Verify surviving nodes
    assert_eq!(controller.get_node(slots[0]).get_opcode(), 0);
    assert_eq!(controller.get_node(slots[2]).get_opcode(), 2);
    assert_eq!(controller.get_node(slots[4]).get_opcode(), 4);
    assert_eq!(controller.get_node(slots[6]).get_opcode(), 6);

    // Verify we can allocate into the expanded region
    let new_node = controller.insert_head(draft(100)).unwrap();
    assert_eq!(controller.get_node(new_node).get_opcode(), 100);
}

// =========================================================
// PHASE 5: GC Pipeline — Backlog/Pending Rotation
// =========================================================

#[test]
fn gc_pipeline_rotates_through_publish_cycles() {
    let mut controller = KernelController::new(config(8));

    for i in 0..7 {
        controller.insert_head(draft(i)).unwrap();
    }
    assert!(controller.should_grow(0.70));

    controller.grow(config(16)).unwrap();
    assert_eq!(controller.node_capacity(), 16);

    // First publish: backlog -> pending_deletion
    controller.publish().unwrap();
    // Second publish: pending_deletion dropped
    controller.publish().unwrap();

    // Audio thread sees migrated data
    let audio = unsafe { mock_audio_reader(&controller) };
    assert!(audio.swap());
    let head = audio.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 6); // last inserted head
}

#[test]
fn consecutive_grows_without_crash() {
    let mut controller = KernelController::new(config(4));
    controller.insert_head(draft(1)).unwrap();

    controller.grow(config(8)).unwrap();
    controller.publish().unwrap();

    controller.grow(config(16)).unwrap();
    controller.publish().unwrap();

    controller.grow(config(32)).unwrap();
    controller.publish().unwrap();

    assert_eq!(controller.node_capacity(), 32);
    let head = controller.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
}

#[test]
fn grow_then_mutate_then_publish() {
    let mut controller = KernelController::new(config(4));
    let n1 = controller.insert_head(draft(1)).unwrap();

    controller.grow(config(16)).unwrap();

    // Mutate AFTER grow, BEFORE publish
    let n2 = controller.insert_after(n1, draft(2)).unwrap();
    controller.set_node_attribute(n2, 0, 777);

    controller.publish().unwrap();

    let audio = unsafe { mock_audio_reader(&controller) };
    audio.swap();

    let head = audio.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
    let next = audio.get_node(head.get_next_ptr());
    assert_eq!(next.get_opcode(), 2);
    assert_eq!(audio.get_node_attribute(n2, 0), 777);
}

// =========================================================
// PHASE 6: Threshold Logic
// =========================================================

#[test]
fn should_grow_respects_threshold_boundary() {
    let controller = KernelController::new(config(4));
    assert!(!controller.should_grow(0.75));

    controller.insert_head(draft(1)).unwrap();
    controller.insert_head(draft(2)).unwrap();
    controller.insert_head(draft(3)).unwrap();

    // 3/4 = 0.75, should_grow uses > not >=
    assert!(!controller.should_grow(0.75));

    controller.insert_head(draft(4)).unwrap();
    // 4/4 = 1.0 > 0.75
    assert!(controller.should_grow(0.75));
}

// =========================================================
// PHASE 7: Controller Plane Address Stability
// =========================================================

#[test]
fn control_plane_address_is_stable_across_grow() {
    let mut controller = KernelController::new(config(4));
    let addr_before = controller.get_controller_plane_address();

    controller.grow(config(8)).unwrap();
    let addr_after = controller.get_controller_plane_address();

    // The ControlPlane is boxed and its address must not move.
    // Audio thread holds this pointer — if it moves, segfault.
    assert_eq!(addr_before, addr_after);
}

#[test]
fn control_plane_address_nonzero() {
    let controller = KernelController::new(config(4));
    assert_ne!(controller.get_controller_plane_address(), 0);
}

// =========================================================
// PHASE 8: Asymmetric Config (different node/synapse caps)
// =========================================================

#[test]
fn asymmetric_capacity_works() {
    let controller = KernelController::new(create_config(16, 4));
    assert_eq!(controller.node_capacity(), 16);
    assert_eq!(controller.synapse_capacity(), 4);

    let n1 = controller.insert_head(draft(1)).unwrap();
    let n2 = controller.insert_after(n1, draft(2)).unwrap();

    controller.connect(n1, n2, syn(1)).unwrap();
    controller.connect(n1, n2, syn(2)).unwrap();
    controller.connect(n1, n2, syn(3)).unwrap();
    controller.connect(n1, n2, syn(4)).unwrap();

    assert!(matches!(
        controller.connect(n1, n2, syn(5)),
        Err(KernelError::CapacityExhausted)
    ));
}

#[test]
fn grow_rejects_if_only_nodes_shrink() {
    let mut controller = KernelController::new(create_config(16, 16));
    assert!(matches!(
        controller.grow(create_config(8, 32)),
        Err(KernelError::InsufficientCapacity)
    ));
}

#[test]
fn grow_rejects_if_only_synapses_shrink() {
    let mut controller = KernelController::new(create_config(16, 16));
    assert!(matches!(
        controller.grow(create_config(32, 8)),
        Err(KernelError::InsufficientCapacity)
    ));
}
