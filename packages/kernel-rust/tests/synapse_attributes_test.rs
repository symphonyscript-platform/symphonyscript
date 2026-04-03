use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::attributes::writer::synapse_attributes_writer::{
    SynapseAttributes, SynapseAttributesWriter,
};
use symphonyscript_kernel::constants::SYNAPSE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ to_array ============

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = SynapseAttributes {
        weight: 1000,
        tick_offset: -10,
        transpose: 12,
        volume_scale: 500,
        duration_scale: 200,
        tempo_scale: 80,
    };

    let array = attrs.to_array();

    assert_eq!(array[0], 1000);
    assert_eq!(array[1], -10);
    assert_eq!(array[2], 12);
    assert_eq!(array[3], 500);
    assert_eq!(array[4], 200);
    assert_eq!(array[5], 80);

    for i in 6..16 {
        assert_eq!(array[i], 0, "slot {} should be zero-padded", i);
    }
}

// ============ View Round-Trips ============

#[test]
fn weight_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_weight(750);
    assert_eq!(view.weight(), 750);
}

#[test]
fn tick_offset_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_tick_offset(-15);
    assert_eq!(view.tick_offset(), -15);
}

#[test]
fn transpose_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_transpose(-7);
    assert_eq!(view.transpose(), -7);
}

#[test]
fn volume_scale_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_volume_scale(1200);
    assert_eq!(view.volume_scale(), 1200);
}

#[test]
fn duration_scale_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_duration_scale(300);
    assert_eq!(view.duration_scale(), 300);
}

#[test]
fn tempo_scale_round_trip() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_tempo_scale(120);
    assert_eq!(view.tempo_scale(), 120);
}

// ============ Isolation ============

#[test]
fn fields_do_not_bleed() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_weight(i32::MAX);
    assert_eq!(view.tick_offset(), 0);
    assert_eq!(view.transpose(), 0);
    assert_eq!(view.volume_scale(), 0);
    assert_eq!(view.duration_scale(), 0);
    assert_eq!(view.tempo_scale(), 0);
}

#[test]
fn reserved_slots_are_zero() {
    let sab = create_sab(64);
    let view = SynapseAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_weight(999);
    view.set_tick_offset(888);
    view.set_transpose(777);
    view.set_volume_scale(666);
    view.set_duration_scale(555);
    view.set_tempo_scale(444);

    // Slots 6..16 must remain untouched
    for i in 6..SYNAPSE_ATTRIBUTES_SLOT_SIZE {
        assert_eq!(view.0.read(i), 0, "reserved slot {} should be zero", i);
    }
}
