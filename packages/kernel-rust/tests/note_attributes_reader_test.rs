use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attribute_plane::reader::note_attributes_reader::NoteAttributesReader;
use symphonyscript_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attribute_plane::writer::note_attributes_writer::NoteAttributes;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn note_attributes_reader_all_fields() {
    let mem = create_mem(MEM_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(
        0,
        NoteAttributes {
            pitch: 60,
            velocity: 100,
            duration: 480,
            volume: 127,
            spatial_x: -50,
            spatial_y: 25,
            spatial_z: 10,
            detune: -5,
            tick_offset: 12,
            flags: 0x01, // sequence 1: muted
        },
    );

    let view = reader.get(0);
    let note = NoteAttributesReader(view);

    assert_eq!(note.pitch(), 60);
    assert_eq!(note.velocity(), 100);
    assert_eq!(note.duration(), 480);
    assert_eq!(note.volume(), 127);
    assert_eq!(note.spatial_x(), -50);
    assert_eq!(note.spatial_y(), 25);
    assert_eq!(note.spatial_z(), 10);
    assert_eq!(note.detune(), -5);
    assert_eq!(note.tick_offset(), 12);
    assert!(note.is_muted());
    assert!(!note.is_solo());
}

#[test]
fn note_attributes_reader_flags_muted_solo() {
    let mem = create_mem(MEM_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(
        0,
        NoteAttributes {
            pitch: 0,
            velocity: 0,
            duration: 0,
            volume: 0,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0x03, // muted + solo
        },
    );

    writer.set(
        1,
        NoteAttributes {
            pitch: 0,
            velocity: 0,
            duration: 0,
            volume: 0,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0x02, // solo only
        },
    );

    let note_full = NoteAttributesReader(reader.get(0));
    assert!(note_full.is_muted());
    assert!(note_full.is_solo());

    let note_solo = NoteAttributesReader(reader.get(1));
    assert!(!note_solo.is_muted());
    assert!(note_solo.is_solo());
}

#[test]
fn reader_handles_negative_values() {
    let mem = create_mem(MEM_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(
        0,
        NoteAttributes {
            pitch: i32::MIN,
            velocity: i32::MAX,
            duration: -1,
            volume: 0,
            spatial_x: 0,
            spatial_y: 0,
            spatial_z: 0,
            detune: 0,
            tick_offset: 0,
            flags: 0,
        },
    );

    let note = NoteAttributesReader(reader.get(0));
    assert_eq!(note.pitch(), i32::MIN);
    assert_eq!(note.velocity(), i32::MAX);
    assert_eq!(note.duration(), -1);
}
