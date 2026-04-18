use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use crate::primitives::struct_writer::StructWriter;
use std::sync::atomic::AtomicI32;
use std::sync::Arc;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn write_then_read_round_trip() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view: StructWriter<'_, 16> = StructWriter::new(&writer, 0);

    view.write(0, 42);
    assert_eq!(view.read(0), 42);
}

#[test]
fn write_all_slots() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view: StructWriter<'_, 16> = StructWriter::new(&writer, 0);

    for i in 0..16 {
        view.write(i, (i as i32) * 100);
    }

    for i in 0..16 {
        assert_eq!(view.read(i), (i as i32) * 100);
    }
}

#[test]
fn fields_do_not_bleed() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view: StructWriter<'_, 16> = StructWriter::new(&writer, 0);

    view.write(0, i32::MAX);
    assert_eq!(view.read(1), 0);
    assert_eq!(view.read(15), 0);
}

#[test]
fn overwrite_replaces_value() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view: StructWriter<'_, 16> = StructWriter::new(&writer, 0);

    view.write(0, 100);
    view.write(0, 200);
    assert_eq!(view.read(0), 200);
}

#[test]
fn two_views_different_offsets_are_independent() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view_a: StructWriter<'_, 16> = StructWriter::new(&writer, 0);
    let view_b: StructWriter<'_, 16> = StructWriter::new(&writer, 16);

    view_a.write(0, 111);
    view_b.write(0, 222);

    assert_eq!(view_a.read(0), 111);
    assert_eq!(view_b.read(0), 222);
}

#[test]
fn negative_values_preserved() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let view: StructWriter<'_, 16> = StructWriter::new(&writer, 0);

    view.write(0, -999);
    view.write(1, i32::MIN);
    assert_eq!(view.read(0), -999);
    assert_eq!(view.read(1), i32::MIN);
}
