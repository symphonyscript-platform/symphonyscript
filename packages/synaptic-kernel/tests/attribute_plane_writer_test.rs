use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use synaptic_kernel::attribute_plane::writer::barrier_attributes_writer::{
    BarrierAttributes, BarrierAttributesWriter,
};
use synaptic_kernel::attribute_plane::writer::boundary_attributes_writer::{
    BoundaryAttributes, BoundaryAttributesWriter,
};
use synaptic_kernel::attribute_plane::writer::control_attributes_writer::{
    ControlAttributes, ControlAttributesWriter,
};
use synaptic_kernel::attribute_plane::writer::note_attributes_writer::{
    NoteAttributes, NoteAttributesWriter,
};
use synaptic_kernel::attribute_plane::writer::synapse_attributes_writer::{
    SynapseAttributes, SynapseAttributesWriter,
};
use synaptic_kernel::constants::{NODE_ATTRIBUTES_SLOT_SIZE, SYNAPSE_ATTRIBUTES_SLOT_SIZE};
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

// ============ AttributePlaneWriter: construction ============

#[test]
fn plane_writer_new_and_end_index() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);
    assert_eq!(plane.mem_end_offset(), CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE);
}

#[test]
fn plane_writer_with_nonzero_start() {
    let mem = create_mem(MEM_SIZE);
    let start = 100;
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, start, CAPACITY);
    assert_eq!(
        plane.mem_end_offset(),
        start + CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE
    );
}

// ============ AttributePlaneWriter: get + read/write ============

#[test]
fn plane_writer_get_write_read_round_trip() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let view = plane.get(0);
    view.write(0, 42);
    view.write(1, 99);

    assert_eq!(view.read(0), 42);
    assert_eq!(view.read(1), 99);
}

#[test]
fn plane_writer_slots_are_independent() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.get(0).write(0, 111);
    plane.get(1).write(0, 222);
    plane.get(2).write(0, 333);

    assert_eq!(plane.get(0).read(0), 111);
    assert_eq!(plane.get(1).read(0), 222);
    assert_eq!(plane.get(2).read(0), 333);
}

#[test]
fn plane_writer_set_bulk_via_into_array() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(
        0,
        NoteAttributes {
            pitch: 60,
            velocity: 100,
            duration: 480,
            volume: 127,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0,
        },
    );

    let view = plane.get(0);
    assert_eq!(view.read(0), 60);
    assert_eq!(view.read(1), 100);
    assert_eq!(view.read(2), 480);
    assert_eq!(view.read(3), 127);
}

#[test]
fn plane_writer_set_then_overwrite() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.get(0).write(0, 100);
    assert_eq!(plane.get(0).read(0), 100);

    plane.get(0).write(0, 200);
    assert_eq!(plane.get(0).read(0), 200);
}

// ============ NoteAttributesWriter ============

#[test]
fn note_attributes_writer_all_fields() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let view = plane.get(0);
    let note = NoteAttributesWriter(view);

    note.set_pitch(60);
    note.set_velocity(100);
    note.set_duration(480);
    note.set_volume(127);
    note.set_spatial_x(-50);
    note.set_spatial_y(25);
    note.set_spatial_z(10);
    note.set_detune(-5);
    note.set_tick_offset(12);

    assert_eq!(note.pitch(), 60);
    assert_eq!(note.velocity(), 100);
    assert_eq!(note.duration(), 480);
    assert_eq!(note.volume(), 127);
    assert_eq!(note.spatial_x(), -50);
    assert_eq!(note.spatial_y(), 25);
    assert_eq!(note.spatial_z(), 10);
    assert_eq!(note.detune(), -5);
    assert_eq!(note.tick_offset(), 12);
}

#[test]
fn note_attributes_writer_flags_muted_solo() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let note = NoteAttributesWriter(plane.get(0));

    assert!(!note.is_muted());
    assert!(!note.is_solo());

    note.set_muted();
    assert!(note.is_muted());
    assert!(!note.is_solo());

    note.set_solo();
    assert!(note.is_muted());
    assert!(note.is_solo());
}

#[test]
fn note_attributes_bulk_set_matches_field_accessors() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(
        0,
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
            flags: 0x03, // muted + solo
        },
    );

    let note = NoteAttributesWriter(plane.get(0));
    assert_eq!(note.pitch(), 72);
    assert_eq!(note.velocity(), 90);
    assert_eq!(note.duration(), 960);
    assert_eq!(note.volume(), 64);
    assert_eq!(note.spatial_x(), 10);
    assert_eq!(note.spatial_y(), 20);
    assert_eq!(note.spatial_z(), 30);
    assert_eq!(note.detune(), -3);
    assert_eq!(note.tick_offset(), 7);
    assert!(note.is_muted());
    assert!(note.is_solo());
}

// ============ SynapseAttributesWriter ============

#[test]
fn synapse_attributes_writer_all_fields() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let syn = SynapseAttributesWriter(plane.get(0));

    syn.set_weight(1000);
    syn.set_tick_offset(-10);
    syn.set_transpose(12);
    syn.set_volume_scale(80);
    syn.set_duration_scale(50);
    syn.set_tempo_scale(120);

    assert_eq!(syn.weight(), 1000);
    assert_eq!(syn.tick_offset(), -10);
    assert_eq!(syn.transpose(), 12);
    assert_eq!(syn.volume_scale(), 80);
    assert_eq!(syn.duration_scale(), 50);
    assert_eq!(syn.tempo_scale(), 120);
}

#[test]
fn synapse_attributes_bulk_set() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<SYNAPSE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(
        0,
        SynapseAttributes {
            weight: 500,
            tick_offset: 3,
            transpose: -7,
            volume_scale: 100,
            duration_scale: 200,
            tempo_scale: 50,
        },
    );

    let syn = SynapseAttributesWriter(plane.get(0));
    assert_eq!(syn.weight(), 500);
    assert_eq!(syn.tick_offset(), 3);
    assert_eq!(syn.transpose(), -7);
    assert_eq!(syn.volume_scale(), 100);
    assert_eq!(syn.duration_scale(), 200);
    assert_eq!(syn.tempo_scale(), 50);
}

// ============ ControlAttributesWriter ============

#[test]
fn control_attributes_writer_round_trip() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let ctrl = ControlAttributesWriter(plane.get(0));
    ctrl.set_control_id(64);
    ctrl.set_value(127);

    assert_eq!(ctrl.control_id(), 64);
    assert_eq!(ctrl.value(), 127);
}

#[test]
fn control_attributes_bulk_set() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(
        0,
        ControlAttributes {
            control_id: 1,
            value: 99,
        },
    );

    let ctrl = ControlAttributesWriter(plane.get(0));
    assert_eq!(ctrl.control_id(), 1);
    assert_eq!(ctrl.value(), 99);
}

// ============ BarrierAttributesWriter ============

#[test]
fn barrier_attributes_writer_round_trip() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let barrier = BarrierAttributesWriter(plane.get(0));
    barrier.set_phase_target(42);
    assert_eq!(barrier.phase_target(), 42);
}

#[test]
fn barrier_attributes_bulk_set() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(0, BarrierAttributes { phase_target: 7 });

    let barrier = BarrierAttributesWriter(plane.get(0));
    assert_eq!(barrier.phase_target(), 7);
}

// ============ BoundaryAttributesWriter ============

#[test]
fn boundary_attributes_writer_round_trip() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let boundary = BoundaryAttributesWriter(plane.get(0));
    boundary.set_boundary_id(99);
    assert_eq!(boundary.boundary_id(), 99);
}

#[test]
fn boundary_attributes_bulk_set() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(0, BoundaryAttributes { boundary_id: 55 });

    let boundary = BoundaryAttributesWriter(plane.get(0));
    assert_eq!(boundary.boundary_id(), 55);
}

// ============ Cross-slot independence with domain types ============

#[test]
fn different_slots_hold_different_note_data() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    plane.set(
        0,
        NoteAttributes {
            pitch: 60,
            velocity: 100,
            duration: 480,
            volume: 127,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0,
        },
    );
    plane.set(
        1,
        NoteAttributes {
            pitch: 72,
            velocity: 50,
            duration: 240,
            volume: 64,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0,
        },
    );

    let n0 = NoteAttributesWriter(plane.get(0));
    let n1 = NoteAttributesWriter(plane.get(1));

    assert_eq!(n0.pitch(), 60);
    assert_eq!(n0.velocity(), 100);
    assert_eq!(n1.pitch(), 72);
    assert_eq!(n1.velocity(), 50);
}

// ============ Negative / extreme values ============

#[test]
fn note_attributes_negative_values() {
    let mem = create_mem(MEM_SIZE);
    let plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);

    let note = NoteAttributesWriter(plane.get(0));
    note.set_pitch(i32::MIN);
    note.set_velocity(i32::MAX);
    note.set_detune(-1);

    assert_eq!(note.pitch(), i32::MIN);
    assert_eq!(note.velocity(), i32::MAX);
    assert_eq!(note.detune(), -1);
}

// ============ Copy From ============

#[test]
fn copy_from_preserves_plane_data() {
    let mem_small = create_mem(MEM_SIZE);
    let small_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem_small, 0, 4);

    let view1 = small_plane.get(0);
    view1.write(0, 42);
    view1.write(5, 99);
    
    let view2 = small_plane.get(3);
    view2.write(1, 1000);

    let mem_large = create_mem(MEM_SIZE);
    let large_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem_large, 0, 16);
    
    large_plane.copy_from(&small_plane);

    // The data perfectly translates to exactly the same logical slots inside the larger capacity bounds
    assert_eq!(large_plane.get(0).read(0), 42);
    assert_eq!(large_plane.get(0).read(5), 99);
    assert_eq!(large_plane.get(3).read(1), 1000);
    
    // Remaining newly allocated memory should be completely 0
    assert_eq!(large_plane.get(4).read(0), 0);
    assert_eq!(large_plane.get(15).read(5), 0);
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let mem_small = create_mem(MEM_SIZE);
    let small_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem_small, 0, 4);

    let mem_large = create_mem(MEM_SIZE);
    let large_plane = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem_large, 0, 16);
    
    small_plane.copy_from(&large_plane);
}
