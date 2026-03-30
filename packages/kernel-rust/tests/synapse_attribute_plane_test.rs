use std::sync::Arc;
use std::sync::atomic::{AtomicI32, Ordering};
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::synapse_attribute_plane::SynapseAttributePlane;
use symphonyscript_kernel::synapse_attributes::{SynapseAttributesData, SynapseAttributesView};

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn sample_data() -> SynapseAttributesData {
    SynapseAttributesData {
        weight: 850,
        tick_offset: -10,
        transpose: 700,
        volume_scale: 500,
    }
}

fn sample_data_b() -> SynapseAttributesData {
    SynapseAttributesData {
        weight: 0,
        tick_offset: 20,
        transpose: -1200,
        volume_scale: 1000,
    }
}

// ============ Construction ============

#[test]
fn new_creates_plane() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);
    assert_eq!(plane.end_index(), 64 * SynapseAttributesView::SLOT_SIZE);
}

#[test]
fn new_with_nonzero_start() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 100, 64);
    assert_eq!(plane.end_index(), 100 + 64 * SynapseAttributesView::SLOT_SIZE);
}

#[test]
#[should_panic(expected = "SynapseAttributePlane out of bounds")]
fn new_panics_when_exceeding_sab() {
    let sab = create_sab(50);
    let _plane = SynapseAttributePlane::new(sab, 0, 100);
}

// ============ Set and Get Round-Trip ============

#[test]
fn set_then_get_all_fields() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);
    let data = sample_data();

    plane.set(0, data);
    let view = plane.get(0);

    assert_eq!(view.weight(), 850);
    assert_eq!(view.tick_offset(), -10);
    assert_eq!(view.transpose(), 700);
    assert_eq!(view.volume_scale(), 500);
}

#[test]
fn set_at_different_offsets() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);

    plane.set(0, sample_data());
    plane.set(1, sample_data_b());

    let view_a = plane.get(0);
    let view_b = plane.get(1);

    assert_eq!(view_a.weight(), 850);
    assert_eq!(view_b.weight(), 0);

    assert_eq!(view_a.transpose(), 700);
    assert_eq!(view_b.transpose(), -1200);
}

#[test]
fn set_overwrites_previous() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);

    plane.set(0, sample_data());
    assert_eq!(plane.get(0).weight(), 850);

    plane.set(0, sample_data_b());
    assert_eq!(plane.get(0).weight(), 0);
    assert_eq!(plane.get(0).transpose(), -1200);
}

// ============ Slot Isolation ============

#[test]
fn slots_are_independent() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);

    plane.set(5, sample_data());

    let view_4 = plane.get(4);
    let view_6 = plane.get(6);

    assert_eq!(view_4.weight(), 0);
    assert_eq!(view_4.transpose(), 0);
    assert_eq!(view_6.weight(), 0);
    assert_eq!(view_6.transpose(), 0);
}

// ============ View Writes Through ============

#[test]
fn view_write_visible_through_plane() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);

    {
        let view = plane.get(0);
        view.set_weight(999);
        view.set_transpose(300);
    }

    let view2 = plane.get(0);
    assert_eq!(view2.weight(), 999);
    assert_eq!(view2.transpose(), 300);
}

// ============ Nonzero Start ============

#[test]
fn nonzero_start_reads_correct_sab_region() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab.clone(), 200, 64);

    plane.set(0, sample_data());

    let raw_weight = sab[200].load(Ordering::Relaxed);
    assert_eq!(raw_weight, 850);
}

#[test]
fn nonzero_start_slot_1_correct_offset() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab.clone(), 200, 64);

    plane.set(1, sample_data());

    // Slot 1 starts at 200 + 8 = 208
    let raw_weight = sab[208].load(Ordering::Relaxed);
    assert_eq!(raw_weight, 850);
}

// ============ Gate Semantics ============

#[test]
fn weight_zero_gates_off() {
    let sab = create_sab(1024);
    let plane = SynapseAttributePlane::new(sab, 0, 64);

    plane.set(0, SynapseAttributesData {
        weight: 0,
        tick_offset: 10,
        transpose: 700,
        volume_scale: 800,
    });

    let view = plane.get(0);
    assert_eq!(view.weight(), 0);
    // Other fields still set even when gated off
    assert_eq!(view.transpose(), 700);
    assert_eq!(view.volume_scale(), 800);
}

// ============ Stress ============

#[test]
fn stress_fill_all_slots() {
    let capacity = 512;
    let sab_size = capacity * SynapseAttributesView::SLOT_SIZE + 1;
    let sab = create_sab(sab_size);
    let plane = SynapseAttributePlane::new(sab, 0, capacity);

    for i in 0..capacity {
        plane.set(i, SynapseAttributesData {
            weight: i as i32 * 2,
            tick_offset: -(i as i32),
            transpose: i as i32 * 100,
            volume_scale: 1000 - i as i32,
        });
    }

    for i in 0..capacity {
        let view = plane.get(i);
        assert_eq!(view.weight(), i as i32 * 2);
        assert_eq!(view.tick_offset(), -(i as i32));
        assert_eq!(view.transpose(), i as i32 * 100);
        assert_eq!(view.volume_scale(), 1000 - i as i32);
    }
}
