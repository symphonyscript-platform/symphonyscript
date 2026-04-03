use symphonyscript_kernel::attributes::writer::note_attributes_writer::NoteAttributes;
use symphonyscript_kernel::attributes::writer::synapse_attributes_writer::SynapseAttributes;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;
use symphonyscript_kernel::synaptic_graph_reader::SynapticGraphReader;
use symphonyscript_kernel::synaptic_graph_writer::{SynapticGraphConfig, SynapticGraphWriter};

fn config() -> SynapticGraphConfig {
    SynapticGraphConfig {
        max_nodes: 16,
        max_synapses: 32,
    }
}

fn setup() -> (SynapticGraphWriter, SynapticGraphReader) {
    let cfg = config();
    let kernel = SynapticGraphWriter::new(cfg);
    // Bind reader using the newly exposed get_sab() test method
    let reader = SynapticGraphReader::bind(kernel.get_sab(), config());
    (kernel, reader)
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
fn reader_bind_creates_empty_chain() {
    let (_kernel, reader) = setup();
    assert!(reader.get_head_node().is_none());
}

// ============ Reader sees nothing before publish/swap ============

#[test]
fn reader_does_not_see_unpublished_nodes() {
    let (kernel, reader) = setup();

    kernel.insert_head(draft(1, 0)).unwrap();

    // no publish, no swap
    assert!(reader.get_head_node().is_none());
}

// ============ Reader sees nodes after publish + swap ============

#[test]
fn reader_sees_nodes_after_publish_swap() {
    let (mut kernel, mut reader) = setup();

    let _slot = kernel.insert_head(draft(5, 999)).unwrap();
    kernel.publish().unwrap();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 5);
    assert_eq!(head.get_base_tick(), 999);
}

#[test]
fn reader_traverses_full_chain() {
    let (mut kernel, mut reader) = setup();

    let _a = kernel.insert_head(draft(1, 10)).unwrap();
    let _b = kernel.insert_head(draft(2, 20)).unwrap();
    let _c = kernel.insert_head(draft(3, 30)).unwrap();
    // chain: c -> b -> a

    kernel.publish().unwrap();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 3);

    let n_b = reader.get_node(head.get_next_ptr());
    assert_eq!(n_b.get_opcode(), 2);

    let n_a = reader.get_node(n_b.get_next_ptr());
    assert_eq!(n_a.get_opcode(), 1);
    assert_eq!(n_a.get_next_ptr(), 0);
}

// ============ Reader sees removal after publish ============

#[test]
fn reader_sees_removal_after_publish_swap() {
    let (mut kernel, mut reader) = setup();

    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let b = kernel.insert_head(draft(2, 0)).unwrap();
    // chain: b -> a

    kernel.remove_node(b);
    // chain: a

    kernel.publish().unwrap();
    reader.swap();

    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
    assert_eq!(head.get_next_ptr(), 0);
}

// ============ Reader snapshot isolation ============

#[test]
fn reader_retains_old_snapshot_without_swap() {
    let (mut kernel, mut reader) = setup();

    // cycle 1
    let a = kernel.insert_head(draft(1, 0)).unwrap();
    kernel.publish().unwrap();
    reader.swap();

    // cycle 2: mutate but reader does NOT swap
    kernel.insert_head(draft(2, 0)).unwrap();
    kernel.publish().unwrap();

    // reader still sees cycle 1 snapshot
    let head = reader.get_head_node().unwrap();
    assert_eq!(head.get_opcode(), 1);
    assert_eq!(head.get_next_ptr(), 0);
}

#[test]
fn reader_sees_updated_snapshot_after_swap() {
    let (mut kernel, mut reader) = setup();

    // cycle 1
    kernel.insert_head(draft(1, 0)).unwrap();
    kernel.publish().unwrap();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_opcode(), 1);

    // cycle 2
    kernel.insert_head(draft(2, 0)).unwrap();
    kernel.publish().unwrap();
    reader.swap();
    assert_eq!(reader.get_head_node().unwrap().get_opcode(), 2);
}

// ============ Reader sees synapse data ============

#[test]
fn reader_sees_synapse_after_publish_swap() {
    let (mut kernel, mut reader) = setup();

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt = kernel.insert_head(draft(2, 0)).unwrap();
    let syn = kernel.connect(src, tgt, syn_draft(42)).unwrap();

    kernel.publish().unwrap();
    reader.swap();

    let s = reader.get_synapse(syn);
    assert_eq!(s.get_opcode(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
}

#[test]
fn reader_traverses_synapse_chain() {
    let (mut kernel, mut reader) = setup();

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt1 = kernel.insert_head(draft(2, 0)).unwrap();
    let tgt2 = kernel.insert_head(draft(3, 0)).unwrap();
    let tgt3 = kernel.insert_head(draft(4, 0)).unwrap();

    let s1 = kernel.connect(src, tgt1, syn_draft(10)).unwrap();
    let s2 = kernel.connect(src, tgt2, syn_draft(20)).unwrap();
    let s3 = kernel.connect(src, tgt3, syn_draft(30)).unwrap();

    kernel.publish().unwrap();
    reader.swap();

    // find src's outgoing head via the node reader
    let src_node = reader.get_node(src);
    assert_eq!(src_node.get_outgoing_synapse_head(), s1);

    // traverse: s1 -> s2 -> s3 -> 0
    let r1 = reader.get_synapse(s1);
    assert_eq!(r1.get_opcode(), 10);
    assert_eq!(r1.get_outgoing_next_ptr(), s2);

    let r2 = reader.get_synapse(s2);
    assert_eq!(r2.get_opcode(), 20);
    assert_eq!(r2.get_outgoing_next_ptr(), s3);

    let r3 = reader.get_synapse(s3);
    assert_eq!(r3.get_opcode(), 30);
    assert_eq!(r3.get_outgoing_next_ptr(), 0);
}

#[test]
fn reader_sees_disconnect_after_publish_swap() {
    let (mut kernel, mut reader) = setup();

    let src = kernel.insert_head(draft(1, 0)).unwrap();
    let tgt1 = kernel.insert_head(draft(2, 0)).unwrap();
    let tgt2 = kernel.insert_head(draft(3, 0)).unwrap();

    let s1 = kernel.connect(src, tgt1, syn_draft(10)).unwrap();
    let s2 = kernel.connect(src, tgt2, syn_draft(20)).unwrap();

    kernel.disconnect(s1);

    kernel.publish().unwrap();
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

    let slot = kernel.insert_head(draft(1, 0)).unwrap();

    // attributes are on shared plane — visible without publish
    kernel.set_node_attribute(slot, 0, 60); // pitch
    kernel.set_node_attribute(slot, 1, 100); // velocity

    assert_eq!(reader.get_node_attribute(slot, 0), 60);
    assert_eq!(reader.get_node_attribute(slot, 1), 100);
}

#[test]
fn reader_sees_bulk_node_attributes() {
    let (kernel, reader) = setup();

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

    let view = reader.get_node_attributes(slot);
    assert_eq!(view.read(0), 72);
    assert_eq!(view.read(1), 90);
    assert_eq!(view.read(2), 960);
    assert_eq!(view.read(3), 64);
}

#[test]
fn reader_sees_synapse_attributes_immediately() {
    let (kernel, reader) = setup();

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

    assert_eq!(reader.get_synapse_attribute(syn, 0), 500);
    assert_eq!(reader.get_synapse_attribute(syn, 1), 3);
    assert_eq!(reader.get_synapse_attribute(syn, 2), -7);
}

#[test]
fn reader_attributes_view_matches_individual_reads() {
    let (kernel, reader) = setup();

    let slot = kernel.insert_head(draft(1, 0)).unwrap();
    kernel.set_node_attribute(slot, 0, 42);
    kernel.set_node_attribute(slot, 5, 99);

    let view = reader.get_node_attributes(slot);
    assert_eq!(view.read(0), reader.get_node_attribute(slot, 0));
    assert_eq!(view.read(5), reader.get_node_attribute(slot, 5));
}

// ============ Multi-cycle with reader ============

#[test]
fn multi_cycle_insert_remove_connect_disconnect() {
    let (mut kernel, mut reader) = setup();

    // cycle 1: build graph A->B with synapse
    let a = kernel.insert_head(draft(1, 100)).unwrap();
    let b = kernel.insert_head(draft(2, 200)).unwrap();
    let s1 = kernel.connect(a, b, syn_draft(10)).unwrap();
    kernel.set_node_attribute(a, 0, 60); // pitch of A
    kernel.publish().unwrap();
    reader.swap();

    // verify cycle 1 snapshot
    assert_eq!(reader.get_node(a).get_opcode(), 1);
    assert_eq!(reader.get_node(b).get_opcode(), 2);
    assert_eq!(reader.get_synapse(s1).get_opcode(), 10);
    assert_eq!(reader.get_node_attribute(a, 0), 60);

    // cycle 2: add C, connect B->C, disconnect A->B
    let c = kernel.insert_head(draft(3, 300)).unwrap();
    let s2 = kernel.connect(b, c, syn_draft(20)).unwrap();
    kernel.disconnect(s1);
    kernel.publish().unwrap();
    reader.swap();

    // verify cycle 2 snapshot
    assert_eq!(reader.get_head_node().unwrap().get_opcode(), 3);
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
    let (_kernel, mut reader) = setup();
    assert!(!reader.swap(), "no publish happened");
}

#[test]
fn swap_returns_true_when_new_data() {
    let (mut kernel, mut reader) = setup();
    kernel.insert_head(draft(1, 0)).unwrap();
    kernel.publish().unwrap();
    assert!(reader.swap(), "publish happened");
}

// ============ Empty chain after removing all ============

#[test]
fn reader_sees_empty_chain_after_removing_all() {
    let (mut kernel, mut reader) = setup();

    let a = kernel.insert_head(draft(1, 0)).unwrap();
    let b = kernel.insert_head(draft(2, 0)).unwrap();

    kernel.remove_node(a);
    kernel.remove_node(b);

    kernel.publish().unwrap();
    reader.swap();

    assert!(reader.get_head_node().is_none());
}

// ============ Attribute mutation visible between publishes ============

#[test]
fn attribute_mutation_visible_between_publishes() {
    let (mut kernel, mut reader) = setup();

    let slot = kernel.insert_head(draft(1, 0)).unwrap();
    kernel.publish().unwrap();
    reader.swap();

    // mutate attribute WITHOUT publishing
    kernel.set_node_attribute(slot, 0, 999);

    // reader sees it immediately (shared plane, not triple-buffered)
    assert_eq!(reader.get_node_attribute(slot, 0), 999);
}
