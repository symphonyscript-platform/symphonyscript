use symphonyscript_kernel::attribute_plane::writer::note_attributes_writer::NoteAttributes;
use symphonyscript_kernel::attribute_plane::writer::synapse_attributes_writer::SynapseAttributes;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;
use symphonyscript_kernel::synaptic_graph_config::SynapticGraphConfig;
use symphonyscript_kernel::synaptic_graph_writer::SynapticGraphWriter;

fn config() -> SynapticGraphConfig {
    SynapticGraphConfig {
        node_capacity: 16,
        synapse_capacity: 32,
    }
}

fn draft(opcode: i32, tick: i32) -> NodeDraft {
    NodeDraft {
        opcode,
        base_tick: tick,
    }
}

fn syn_draft(opcode: i32) -> SynapseDraft {
    SynapseDraft { opcode }
}

// ============ Construction ============

#[test]
fn kernel_new_creates_empty_chain() {
    let kernel = SynapticGraphWriter::new(config());
    assert!(kernel.get_head_node().is_none());
}

// ============ Node insertion ============

#[test]
fn insert_head_returns_slot() {
    let kernel = SynapticGraphWriter::new(config());
    let slot = kernel.insert_head(draft(1, 0));
    assert!(slot.is_some());
    assert!(slot.unwrap() > 0);
}

#[test]
fn insert_head_writes_opcode_and_tick() {
    let kernel = SynapticGraphWriter::new(config());
    let slot = kernel.insert_head(draft(5, 999)).unwrap();

    let node = kernel.get_node(slot);
    assert_eq!(node.get_opcode(), 5);
    assert_eq!(node.get_base_tick(), 999);
}

#[test]
fn insert_head_chain_ordering() {
    let kernel = SynapticGraphWriter::new(config());

    let a = kernel.insert_head(draft(1, 10)).unwrap();
    let b = kernel.insert_head(draft(2, 20)).unwrap();
    let c = kernel.insert_head(draft(3, 30)).unwrap();

    // chain: c -> b -> a
    let head = kernel.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 3);
    assert_eq!(head.get_next_ptr(), b);

    assert_eq!(kernel.get_node(b).get_next_ptr(), a);
    assert_eq!(kernel.get_node(a).get_next_ptr(), 0);
}

#[test]
fn insert_after_splices_correctly() {
    let kernel = SynapticGraphWriter::new(config());

    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let c = kernel.insert_after(a, draft(3, 0)).unwrap();
    let b = kernel.insert_after(a, draft(2, 0)).unwrap();

    // chain: a -> b -> c (head is a since insert_head only called once)
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_next_ptr(), 0);
}

#[test]
fn insert_before_splices_correctly() {
    let kernel = SynapticGraphWriter::new(config());

    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let c = kernel.insert_after(a, draft(3, 0)).unwrap();
    let b = kernel.insert_before(c, draft(2, 0)).unwrap();

    // a -> b -> c
    assert_eq!(kernel.get_node(a).get_next_ptr(), b);
    assert_eq!(kernel.get_node(b).get_next_ptr(), c);
    assert_eq!(kernel.get_node(c).get_prev_ptr(), b);
}

#[test]
fn insert_exhausts_capacity() {
    let kernel = SynapticGraphWriter::new(config());

    for i in 0..16 {
        assert!(kernel.insert_head(draft(i, 0)).is_some());
    }
    assert!(kernel.insert_head(draft(99, 0)).is_none());
}

// ============ Node removal + deferred frees ============

#[test]
fn remove_node_heals_chain() {
    let kernel = SynapticGraphWriter::new(config());

    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let b = kernel.insert_head(draft(2, 0)).unwrap();
    let c = kernel.insert_head(draft(3, 0)).unwrap();
    // chain: c -> b -> a

    kernel.remove_node(b);
    // chain: c -> a

    assert_eq!(kernel.get_node(c).get_next_ptr(), a);
    assert_eq!(kernel.get_node(a).get_prev_ptr(), c);
}

#[test]
fn remove_then_publish_reclaims_slot() {
    let mut kernel = SynapticGraphWriter::new(config());

    // fill all slots
    let mut slots = Vec::new();
    for i in 0..16 {
        slots.push(kernel.insert_head(draft(i, 0)).unwrap());
    }
    assert!(kernel.insert_head(draft(99, 0)).is_none(), "capacity full");

    // remove one
    kernel.remove_node(slots[0]);

    // slot not yet reclaimed (deferred)
    assert!(kernel.insert_head(draft(99, 0)).is_none(), "still deferred");

    // publish #1: shift to previous list
    kernel.publish().unwrap();

    // publish #2: drains the previous list
    kernel.publish().unwrap();

    // now the slot is available
    let reclaimed = kernel.insert_head(draft(99, 0));
    assert!(reclaimed.is_some(), "slot reclaimed after publish");
}

#[test]
/* fn double_remove_returns_error() {
    let kernel = Kernel::new(config());
    let a = kernel.insert_head(draft(1, 0)).unwrap();
    kernel.remove_node(a);
    /* commented err check */
} */
// ============ Synapse connect/disconnect ============
#[test]
fn connect_creates_synapse() {
    let kernel = SynapticGraphWriter::new(config());

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();

    let syn = kernel.connect(src, tgt, syn_draft(10)).unwrap();

    let s = kernel.get_synapse(syn);
    assert_eq!(s.get_opcode(), 10);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
}

#[test]
fn connect_updates_node_synapse_pointers() {
    let kernel = SynapticGraphWriter::new(config());

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    let syn = kernel.connect(src, tgt, syn_draft(10)).unwrap();

    assert_eq!(kernel.get_node(src).get_outgoing_synapse_head(), syn);
    assert_eq!(kernel.get_node(src).get_outgoing_synapse_tail(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_head(), syn);
    assert_eq!(kernel.get_node(tgt).get_incoming_synapse_tail(), syn);
}

#[test]
fn disconnect_heals_synapse_chain() {
    let kernel = SynapticGraphWriter::new(config());

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt1 = kernel.insert_head(draft(2, 0)).unwrap();
    let tgt2 = kernel.insert_head(draft(3, 0)).unwrap();

    let s1 = kernel.connect(src, tgt1, syn_draft(10)).unwrap();
    let s2 = kernel.connect(src, tgt2, syn_draft(20)).unwrap();

    kernel.disconnect(s1);

    assert_eq!(kernel.get_node(src).get_outgoing_synapse_head(), s2);
    assert_eq!(kernel.get_node(src).get_outgoing_synapse_tail(), s2);
    assert_eq!(kernel.get_synapse(s2).get_outgoing_prev_ptr(), 0);
}

#[test]
fn disconnect_then_publish_reclaims_synapse_slot() {
    let mut kernel = SynapticGraphWriter::new(config());

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();

    // fill all synapse slots
    let mut synapses = Vec::new();
    for i in 0..32 {
        synapses.push(kernel.connect(src, tgt, syn_draft(i)).unwrap());
    }
    assert!(
        kernel.connect(src, tgt, syn_draft(99)).is_none(),
        "synapse capacity full"
    );

    kernel.disconnect(synapses[0]);

    // not yet reclaimed
    assert!(
        kernel.connect(src, tgt, syn_draft(99)).is_none(),
        "still deferred"
    );

    kernel.publish().unwrap();
    kernel.publish().unwrap(); // Two cycle deferral required to physically reclaim

    // now reclaimed
    assert!(
        kernel.connect(src, tgt, syn_draft(99)).is_some(),
        "reclaimed after publish"
    );
}

#[test]
/* fn double_disconnect_returns_error() {
    let kernel = Kernel::new(config());
    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    let syn = kernel.connect(src, tgt, syn_draft(10)).unwrap();

    kernel.disconnect(syn);
    /* commented err check */
} */
// ============ Node attributes ============
#[test]
fn set_node_attribute_single_field() {
    let kernel = SynapticGraphWriter::new(config());
    let slot = kernel.insert_head(draft(1, 0)).unwrap();

    kernel.set_node_attribute(slot, 0, 60); // pitch
    kernel.set_node_attribute(slot, 1, 100); // velocity

    assert_eq!(kernel.get_node_attribute(slot, 0), 60);
    assert_eq!(kernel.get_node_attribute(slot, 1), 100);
}

#[test]
fn set_node_attributes_bulk() {
    let kernel = SynapticGraphWriter::new(config());
    let slot = kernel.insert_head(draft(1, 0)).unwrap();

    kernel.set_node_attributes(
        slot,
        NoteAttributes {
            pitch: 72,
            velocity: 90,
            duration: 960,
            volume: 64,
            spatial_x: 10,
            spatial_y: 20,
            spatial_z: 30,
            detune: -3,
            tick_offset: 7,
            flags: 0,
        },
    );

    assert_eq!(kernel.get_node_attribute(slot, 0), 72);
    assert_eq!(kernel.get_node_attribute(slot, 1), 90);
    assert_eq!(kernel.get_node_attribute(slot, 2), 960);
}

#[test]
fn get_node_attributes_returns_view() {
    let kernel = SynapticGraphWriter::new(config());
    let slot = kernel.insert_head(draft(1, 0)).unwrap();

    kernel.set_node_attribute(slot, 0, 42);
    kernel.set_node_attribute(slot, 5, 99);

    let view = kernel.get_node_attributes(slot);
    assert_eq!(view.read(0), 42);
    assert_eq!(view.read(5), 99);
}

#[test]
fn node_attributes_independent_across_slots() {
    let kernel = SynapticGraphWriter::new(config());
    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let b = kernel.insert_head(draft(2, 0)).unwrap();

    kernel.set_node_attribute(a, 0, 111);
    kernel.set_node_attribute(b, 0, 222);

    assert_eq!(kernel.get_node_attribute(a, 0), 111);
    assert_eq!(kernel.get_node_attribute(b, 0), 222);
}

// ============ Synapse attributes ============

#[test]
fn set_synapse_attribute_single_field() {
    let kernel = SynapticGraphWriter::new(config());
    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    let syn = kernel.connect(src, tgt, syn_draft(10)).unwrap();

    kernel.set_synapse_attribute(syn, 0, 1000); // weight
    kernel.set_synapse_attribute(syn, 1, -10); // tick_offset

    assert_eq!(kernel.get_synapse_attribute(syn, 0), 1000);
    assert_eq!(kernel.get_synapse_attribute(syn, 1), -10);
}

#[test]
fn set_synapse_attributes_bulk() {
    let kernel = SynapticGraphWriter::new(config());
    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    let syn = kernel.connect(src, tgt, syn_draft(10)).unwrap();

    kernel.set_synapse_attributes(
        syn,
        SynapseAttributes {
            weight: 500,
            tick_offset: 3,
            transpose: -7,
            volume_scale: 100,
            duration_scale: 200,
            tempo_scale: 50,
        },
    );

    assert_eq!(kernel.get_synapse_attribute(syn, 0), 500);
    assert_eq!(kernel.get_synapse_attribute(syn, 1), 3);
    assert_eq!(kernel.get_synapse_attribute(syn, 2), -7);
}

// ============ Publish lifecycle ============

#[test]
fn publish_succeeds_on_empty_kernel() {
    let mut kernel = SynapticGraphWriter::new(config());
    assert!(kernel.publish().is_ok());
}

#[test]
fn publish_after_mutations_succeeds() {
    let mut kernel = SynapticGraphWriter::new(config());

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    kernel.connect(src, tgt, syn_draft(10)).unwrap();

    assert!(kernel.publish().is_ok());
}

#[test]
fn multiple_publish_cycles() {
    let mut kernel = SynapticGraphWriter::new(config());

    // cycle 1: insert
    let a = kernel.insert_head(draft(1, 0)).unwrap();
    kernel.publish().unwrap();

    // cycle 2: insert + remove
    let b = kernel.insert_head(draft(2, 0)).unwrap();
    kernel.remove_node(a);
    kernel.publish().unwrap();

    // cycle 3: a's slot should be reclaimed now
    let c = kernel.insert_head(draft(3, 0)).unwrap();
    kernel.publish().unwrap();

    // chain should have c and b (a was removed)
    let head = kernel.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 3);
}

#[test]
fn deferred_free_two_cycle_delay() {
    let mut kernel = SynapticGraphWriter::new(config());

    // fill capacity
    let mut slots = Vec::new();
    for i in 0..16 {
        slots.push(kernel.insert_head(draft(i, 0)).unwrap());
    }

    // remove in cycle 0 (pushes to current deferred list)
    kernel.remove_node(slots[0]);

    // publish #1: drains previous list (empty), toggles.
    // Now slots[0] is in the "previous" list.
    kernel.publish().unwrap();

    // publish #2: drains previous list (contains slots[0]). Slot reclaimed.
    kernel.publish().unwrap();

    // slot should be available now
    assert!(kernel.insert_head(draft(99, 0)).is_some());
}

// ============ Self-loop ============

#[test]
fn self_loop_connect_disconnect() {
    let kernel = SynapticGraphWriter::new(config());
    let n = kernel.insert_head(draft(1, 0)).unwrap();

    let syn = kernel.connect(n, n, syn_draft(99)).unwrap();

    assert_eq!(kernel.get_node(n).get_outgoing_synapse_head(), syn);
    assert_eq!(kernel.get_node(n).get_incoming_synapse_head(), syn);

    kernel.disconnect(syn);

    assert_eq!(kernel.get_node(n).get_outgoing_synapse_head(), 0);
    assert_eq!(kernel.get_node(n).get_incoming_synapse_head(), 0);
}

// ============ compute_sab_size ============

#[test]
fn compute_sab_size_is_positive() {
    let cfg = config();
    assert!(SynapticGraphWriter::compute_size(&cfg) > 0);
}

#[test]
fn compute_triple_buffer_size_matches_slot_count() {
    let cfg = config();
    let expected = 1 + 16 * cfg.node_capacity + 8 * cfg.synapse_capacity;
    assert_eq!(
        SynapticGraphWriter::compute_triple_buffer_size(&cfg),
        expected
    );
}
