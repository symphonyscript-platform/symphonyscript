use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;
use synaptic_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use synaptic_kernel::attribute_plane::writer::note_attributes_writer::{
    NoteAttributes, NoteAttributesWriter,
};
use synaptic_kernel::primitives::types::AtomicBuffer;

const SLOT_SIZE: usize = 16;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn sample_data() -> NoteAttributes {
    NoteAttributes {
        pitch: 570000,
        velocity: 100,
        duration: 480,
        volume: 800,
        spatial_x: -500,
        spatial_y: 200,
        spatial_z: 0,
        detune: 50,
        tick_offset: -10,
        flags: 0,
    }
}

fn sample_data_b() -> NoteAttributes {
    NoteAttributes {
        pitch: 440000,
        velocity: 80,
        duration: 240,
        volume: 600,
        spatial_x: 300,
        spatial_y: -100,
        spatial_z: 50,
        detune: -20,
        tick_offset: 5,
        flags: 0b11,
    }
}

// ============ Construction ============

#[test]
fn new_creates_plane() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);
    assert_eq!(plane.mem_end_offset(), 10 * SLOT_SIZE);
}

#[test]
fn new_with_nonzero_start() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 100, 10);
    assert_eq!(plane.mem_end_offset(), 100 + 10 * SLOT_SIZE);
}

#[test]
#[should_panic(expected = "AttributePlaneWriter::new | range")]
fn new_panics_when_exceeding_mem() {
    let mem = create_mem(50);
    let _plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 100); // 100 * 10 = 1000 > 50
}

#[test]
fn new_succeeds_at_exact_boundary() {
    // mem_end_offset == mem.len() is valid and should not panic (<=, not <)
    let size = 10 * SLOT_SIZE;
    let mem = create_mem(size);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);
    assert_eq!(plane.mem_end_offset(), size);
}

// ============ Set and Get Round-Trip ============

#[test]
fn set_then_get_all_fields() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);
    let data = sample_data();

    plane.set(0, data);
    let view = NoteAttributesWriter(plane.get(0));

    assert_eq!(view.pitch(), 570000);
    assert_eq!(view.velocity(), 100);
    assert_eq!(view.duration(), 480);
    assert_eq!(view.volume(), 800);
    assert_eq!(view.spatial_x(), -500);
    assert_eq!(view.spatial_y(), 200);
    assert_eq!(view.spatial_z(), 0);
    assert_eq!(view.detune(), 50);
    assert_eq!(view.tick_offset(), -10);
    assert_eq!(view.flags(), 0);
}

#[test]
fn set_at_different_offsets() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    plane.set(0, sample_data());
    plane.set(1, sample_data_b());

    let view_a = NoteAttributesWriter(plane.get(0));
    let view_b = NoteAttributesWriter(plane.get(1));

    assert_eq!(view_a.pitch(), 570000);
    assert_eq!(view_b.pitch(), 440000);

    assert_eq!(view_a.velocity(), 100);
    assert_eq!(view_b.velocity(), 80);

    assert_eq!(view_a.flags(), 0);
    assert_eq!(view_b.flags(), 0b11);
}

#[test]
fn set_overwrites_previous() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    plane.set(0, sample_data());
    assert_eq!(NoteAttributesWriter(plane.get(0)).pitch(), 570000);

    plane.set(0, sample_data_b());
    assert_eq!(NoteAttributesWriter(plane.get(0)).pitch(), 440000);
    assert_eq!(NoteAttributesWriter(plane.get(0)).velocity(), 80);
}

// ============ Slot Isolation ============

#[test]
fn slots_are_independent() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    plane.set(3, sample_data());

    // Neighbor slots should be untouched
    let view_2 = NoteAttributesWriter(plane.get(2));
    let view_4 = NoteAttributesWriter(plane.get(4));

    assert_eq!(view_2.pitch(), 0);
    assert_eq!(view_2.velocity(), 0);
    assert_eq!(view_4.pitch(), 0);
    assert_eq!(view_4.velocity(), 0);
}

// ============ View Writes Through to Plane ============

#[test]
fn view_write_visible_through_plane() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    {
        let view = NoteAttributesWriter(plane.get(0));
        view.set_pitch(999);
        view.set_velocity(42);
    }

    let view2 = NoteAttributesWriter(plane.get(0));
    assert_eq!(view2.pitch(), 999);
    assert_eq!(view2.velocity(), 42);
}

// ============ Nonzero Start Index ============

#[test]
fn nonzero_start_reads_correct_mem_region() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem.clone(), 200, 10);

    plane.set(0, sample_data());

    // Verify the AtomicBuffer was written at the correct offset
    let raw_pitch = mem[200].load(Ordering::Relaxed);
    assert_eq!(raw_pitch, 570000);
}

#[test]
fn nonzero_start_slot_1_correct_offset() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem.clone(), 200, 10);

    plane.set(1, sample_data());

    // Slot 1 starts at 200 + 16 = 216
    let raw_pitch = mem[216].load(Ordering::Relaxed);
    assert_eq!(raw_pitch, 570000);
}

// ============ End Index ============

#[test]
fn mem_end_offset_zero_start() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 8);
    assert_eq!(plane.mem_end_offset(), 8 * 16);
}

#[test]
fn mem_end_offset_with_start_offset() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 50, 8);
    assert_eq!(plane.mem_end_offset(), 50 + 8 * 16);
}

// ============ Capacity Boundary ============

#[test]
fn get_last_valid_slot() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    plane.set(9, sample_data());
    assert_eq!(NoteAttributesWriter(plane.get(9)).pitch(), 570000);
}

#[test]
fn set_last_valid_slot() {
    let mem = create_mem(1024);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, 10);

    plane.set(9, sample_data_b());
    assert_eq!(NoteAttributesWriter(plane.get(9)).velocity(), 80);
}

// ============ Stress ============

#[test]
fn stress_fill_all_slots() {
    let capacity = 256;
    let mem_size = capacity * SLOT_SIZE + 1;
    let mem = create_mem(mem_size);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, capacity);

    for i in 0..capacity {
        plane.set(
            i,
            NoteAttributes {
                pitch: i as i32 * 1000,
                velocity: i as i32,
                duration: 480,
                volume: 800,
                spatial_x: 0,
                spatial_y: 0,
                spatial_z: 0,
                detune: 0,
                tick_offset: 0,
                flags: 0,
            },
        );
    }

    for i in 0..capacity {
        let view = NoteAttributesWriter(plane.get(i));
        assert_eq!(view.pitch(), i as i32 * 1000);
        assert_eq!(view.velocity(), i as i32);
    }
}

#[test]
fn stress_overwrite_all_slots() {
    let capacity = 128;
    let mem_size = capacity * SLOT_SIZE + 1;
    let mem = create_mem(mem_size);
    let plane = AttributePlaneWriter::<SLOT_SIZE>::new(mem, 0, capacity);

    // Write pass 1
    for i in 0..capacity {
        plane.set(
            i,
            NoteAttributes {
                pitch: 100,
                velocity: 100,
                duration: 100,
                volume: 100,
                spatial_x: 100,
                spatial_y: 100,
                spatial_z: 100,
                detune: 100,
                tick_offset: 100,
                flags: 100,
            },
        );
    }

    // Write pass 2 (overwrite)
    for i in 0..capacity {
        plane.set(
            i,
            NoteAttributes {
                pitch: i as i32,
                velocity: i as i32 + 1,
                duration: i as i32 + 2,
                volume: i as i32 + 3,
                spatial_x: i as i32 + 4,
                spatial_y: i as i32 + 5,
                spatial_z: i as i32 + 6,
                detune: i as i32 + 7,
                tick_offset: i as i32 + 8,
                flags: i as u32 + 9,
            },
        );
    }

    for i in 0..capacity {
        let v = NoteAttributesWriter(plane.get(i));
        assert_eq!(v.pitch(), i as i32);
        assert_eq!(v.velocity(), i as i32 + 1);
        assert_eq!(v.duration(), i as i32 + 2);
        assert_eq!(v.volume(), i as i32 + 3);
        assert_eq!(v.spatial_x(), i as i32 + 4);
        assert_eq!(v.spatial_y(), i as i32 + 5);
        assert_eq!(v.spatial_z(), i as i32 + 6);
        assert_eq!(v.detune(), i as i32 + 7);
        assert_eq!(v.tick_offset(), i as i32 + 8);
        assert_eq!(v.flags(), i as u32 + 9);
    }
}
