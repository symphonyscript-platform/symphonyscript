use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::attributes::writer::note_attributes_writer::{NoteAttributes, NoteAttributesWriter};
use symphonyscript_kernel::primitives::into_array::IntoArray;

const SLOT_SIZE: usize = 16;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ Construction ============

#[test]
fn new_creates_view_at_start_index() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    assert_eq!(view.pitch(), 0);
    assert_eq!(view.velocity(), 0);
    assert_eq!(view.flags(), 0);
}

#[test]
fn new_creates_view_at_nonzero_start_index() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 50));
    assert_eq!(view.pitch(), 0);
}

#[test]
fn slot_size_is_16() {
    assert_eq!(SLOT_SIZE, 16);
}

// ============ Read/Write Round-Trip ============

#[test]
fn pitch_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_pitch(570000);
    assert_eq!(view.pitch(), 570000);
}

#[test]
fn velocity_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_velocity(127);
    assert_eq!(view.velocity(), 127);
}

#[test]
fn duration_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_duration(480);
    assert_eq!(view.duration(), 480);
}

#[test]
fn volume_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_volume(1000);
    assert_eq!(view.volume(), 1000);
}

#[test]
fn spatial_x_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_spatial_x(-1000);
    assert_eq!(view.spatial_x(), -1000);
}

#[test]
fn spatial_y_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_spatial_y(500);
    assert_eq!(view.spatial_y(), 500);
}

#[test]
fn spatial_z_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_spatial_z(-250);
    assert_eq!(view.spatial_z(), -250);
}

#[test]
fn detune_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_detune(42);
    assert_eq!(view.detune(), 42);
}

#[test]
fn tick_offset_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_tick_offset(-15);
    assert_eq!(view.tick_offset(), -15);
}

#[test]
fn flags_round_trip() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_flags(0b11);
    assert_eq!(view.flags(), 0b11);
}

#[test]
fn negative_values_preserved() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_pitch(-100);
    view.set_velocity(-1);
    view.set_tick_offset(i32::MIN);

    assert_eq!(view.pitch(), -100);
    assert_eq!(view.velocity(), -1);
    assert_eq!(view.tick_offset(), i32::MIN);
}

#[test]
fn extreme_values() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_pitch(i32::MAX);
    assert_eq!(view.pitch(), i32::MAX);

    view.set_pitch(i32::MIN);
    assert_eq!(view.pitch(), i32::MIN);

    view.set_flags(u32::MAX);
    assert_eq!(view.flags(), u32::MAX);

    view.set_flags(0);
    assert_eq!(view.flags(), 0);
}

// ============ Flags Convenience Methods ============

#[test]
fn is_muted_default_false() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    assert!(!view.is_muted());
}

#[test]
fn set_muted_then_is_muted() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_muted();
    assert!(view.is_muted());
}

#[test]
fn is_solo_default_false() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    assert!(!view.is_solo());
}

#[test]
fn set_solo_then_is_solo() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_solo();
    assert!(view.is_solo());
}

#[test]
fn muted_and_solo_independent() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_muted();
    assert!(view.is_muted());
    assert!(!view.is_solo());

    view.set_solo();
    assert!(view.is_muted());
    assert!(view.is_solo());
}

#[test]
fn set_muted_preserves_other_flags() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_flags(0b11111100); // bits 2-7 set
    view.set_muted();
    assert_eq!(view.flags(), 0b11111101); // bit 0 added
    assert!(view.is_muted());
}

#[test]
fn set_solo_preserves_other_flags() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_flags(0b11111101); // bit 0 + bits 2-7
    view.set_solo();
    assert_eq!(view.flags(), 0b11111111); // bit 1 added
    assert!(view.is_solo());
    assert!(view.is_muted());
}


// ============ Multiple Views on Same SAB ============

#[test]
fn two_views_different_offsets_are_independent() {
    let sab = create_sab(256);
    let view_a = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    let view_b = NoteAttributesWriter(AttributesWriter::new(&sab, 10));

    view_a.set_pitch(100);
    view_b.set_pitch(200);

    assert_eq!(view_a.pitch(), 100);
    assert_eq!(view_b.pitch(), 200);
}

#[test]
fn views_share_sab_see_each_others_writes() {
    let sab = create_sab(128);
    let view_a = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    let view_b = NoteAttributesWriter(AttributesWriter::new(&sab, 0)); // same offset

    view_a.set_pitch(999);
    assert_eq!(view_b.pitch(), 999);
}

// ============ Overwrite Behavior ============

#[test]
fn overwrite_replaces_value() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_pitch(100);
    assert_eq!(view.pitch(), 100);

    view.set_pitch(200);
    assert_eq!(view.pitch(), 200);
}

#[test]
fn fields_do_not_bleed_into_neighbors() {
    let sab = create_sab(128);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_pitch(i32::MAX);
    assert_eq!(view.velocity(), 0);
    assert_eq!(view.duration(), 0);

    view.set_flags(u32::MAX);
    assert_eq!(view.tick_offset(), 0);
}

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = NoteAttributes {
        pitch: 600000,
        velocity: 100,
        duration: 960,
        volume: 800,
        spatial_x: -50,
        spatial_y: 200,
        spatial_z: 0,
        detune: 15,
        tick_offset: -5,
        flags: 0b11,
    };
    
    let array = attrs.to_array();
    
    // Explicit padding and assignment assertions
    assert_eq!(array[0], 600000);
    assert_eq!(array[1], 100);
    assert_eq!(array[2], 960);
    assert_eq!(array[3], 800);
    assert_eq!(array[4], -50);
    assert_eq!(array[5], 200);
    assert_eq!(array[6], 0);
    assert_eq!(array[7], 15);
    assert_eq!(array[8], -5);
    assert_eq!(array[9], 0b11);
    
    for i in 10..16 {
        assert_eq!(array[i], 0);
    }
}
