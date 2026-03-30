use std::sync::Arc;
use std::sync::atomic::{AtomicI32, Ordering};
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::synapse_attributes::SynapseAttributesView;

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
    let view = SynapseAttributesView::new(&sab, 0);
    assert_eq!(view.weight(), 0);
    assert_eq!(view.tick_offset(), 0);
    assert_eq!(view.transpose(), 0);
    assert_eq!(view.volume_scale(), 0);
}

#[test]
fn new_creates_view_at_nonzero_start_index() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 40);
    assert_eq!(view.weight(), 0);
}

#[test]
fn slot_size_is_8() {
    assert_eq!(SynapseAttributesView::SLOT_SIZE, 8);
}

// ============ Read/Write Round-Trip ============

#[test]
fn weight_round_trip() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_weight(850);
    assert_eq!(view.weight(), 850);
}

#[test]
fn tick_offset_round_trip() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_tick_offset(-15);
    assert_eq!(view.tick_offset(), -15);
}

#[test]
fn transpose_round_trip() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_transpose(700); // perfect fifth in centicents
    assert_eq!(view.transpose(), 700);
}

#[test]
fn transpose_negative_round_trip() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_transpose(-1200); // octave down
    assert_eq!(view.transpose(), -1200);
}

#[test]
fn volume_scale_round_trip() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_volume_scale(500);
    assert_eq!(view.volume_scale(), 500);
}

#[test]
fn extreme_values() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);

    view.set_weight(i32::MAX);
    assert_eq!(view.weight(), i32::MAX);

    view.set_weight(i32::MIN);
    assert_eq!(view.weight(), i32::MIN);

    view.set_transpose(i32::MAX);
    assert_eq!(view.transpose(), i32::MAX);

    view.set_tick_offset(i32::MIN);
    assert_eq!(view.tick_offset(), i32::MIN);
}

#[test]
fn weight_zero_is_gate_off() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_weight(1000);
    assert_eq!(view.weight(), 1000);

    view.set_weight(0);
    assert_eq!(view.weight(), 0);
}

// ============ SAB Index Resolution ============

#[test]
fn resolve_sab_index_offset_zero() {
    assert_eq!(SynapseAttributesView::resolve_sab_index(100, 0), 100);
}

#[test]
fn resolve_sab_index_offset_one() {
    assert_eq!(SynapseAttributesView::resolve_sab_index(100, 1), 108);
}

#[test]
fn resolve_sab_index_offset_n() {
    assert_eq!(SynapseAttributesView::resolve_sab_index(0, 5), 40);
    assert_eq!(SynapseAttributesView::resolve_sab_index(200, 3), 224);
}

// ============ Multiple Views ============

#[test]
fn two_views_different_offsets_are_independent() {
    let sab = create_sab(256);
    let view_a = SynapseAttributesView::new(&sab, 0);
    let view_b = SynapseAttributesView::new(&sab, 8);

    view_a.set_weight(500);
    view_b.set_weight(900);

    assert_eq!(view_a.weight(), 500);
    assert_eq!(view_b.weight(), 900);
}

#[test]
fn views_same_offset_share_writes() {
    let sab = create_sab(128);
    let view_a = SynapseAttributesView::new(&sab, 0);
    let view_b = SynapseAttributesView::new(&sab, 0);

    view_a.set_weight(777);
    assert_eq!(view_b.weight(), 777);
}

// ============ Field Isolation ============

#[test]
fn fields_do_not_bleed() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);

    view.set_weight(i32::MAX);
    assert_eq!(view.tick_offset(), 0);
    assert_eq!(view.transpose(), 0);
    assert_eq!(view.volume_scale(), 0);

    view.set_volume_scale(i32::MAX);
    assert_eq!(view.transpose(), 0);
}

#[test]
fn overwrite_replaces_value() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);

    view.set_weight(100);
    assert_eq!(view.weight(), 100);

    view.set_weight(900);
    assert_eq!(view.weight(), 900);
}

// ============ Reserved Slots ============

#[test]
fn reserved_slots_are_zero() {
    let sab = create_sab(128);
    let _view = SynapseAttributesView::new(&sab, 0);

    // Slots 4-7 are reserved and should be zero
    for i in 4..8 {
        assert_eq!(sab[i].load(Ordering::Relaxed), 0);
    }
}

#[test]
fn writing_attributes_does_not_touch_reserved() {
    let sab = create_sab(128);
    let view = SynapseAttributesView::new(&sab, 0);

    view.set_weight(1000);
    view.set_tick_offset(-50);
    view.set_transpose(700);
    view.set_volume_scale(800);

    for i in 4..8 {
        assert_eq!(sab[i].load(Ordering::Relaxed), 0);
    }
}
