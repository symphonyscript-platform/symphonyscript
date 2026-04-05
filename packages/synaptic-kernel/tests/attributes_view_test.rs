use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::attribute_plane::attributes_writer::AttributesWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn new_creates_view_at_start_index() {
    let mem = create_mem(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 0);

    for i in 0..16 {
        assert_eq!(view.get(i), 0);
    }
}

#[test]
fn raw_read_write_round_trip() {
    let mem = create_mem(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 10);

    view.set(0, 500);
    view.set(15, -42);

    assert_eq!(view.get(0), 500);
    assert_eq!(view.get(15), -42);
}

#[test]
fn fields_do_not_bleed() {
    let mem = create_mem(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 0);

    view.set(0, i32::MAX);
    assert_eq!(view.get(1), 0);

    view.set(1, i32::MIN);
    assert_eq!(view.get(0), i32::MAX);
}

#[test]
fn two_views_different_offsets_are_independent() {
    let mem = create_mem(128);
    let view_a: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 0);
    let view_b: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 16);

    view_a.set(0, 100);
    view_b.set(0, 200);

    assert_eq!(view_a.get(0), 100);
    assert_eq!(view_b.get(0), 200);
}

#[test]
fn two_views_share_mem_see_writes() {
    let mem = create_mem(128);
    let view_a: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 10);
    let view_b: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 10);

    view_a.set(5, 999);
    assert_eq!(view_b.get(5), 999);
}

#[test]
fn works_with_different_slot_sizes() {
    let mem = create_mem(128);
    let view_8: AttributesWriter<'_, 8> = AttributesWriter::new(&mem, 0);
    let view_16: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 64);

    view_8.set(0, 111);
    view_16.set(0, 222);

    assert_eq!(view_8.get(0), 111);
    assert_eq!(view_16.get(0), 222);
}

#[test]
#[should_panic(expected = "AttributesWriter::new | range")]
fn new_panics_if_out_of_bounds() {
    let mem = create_mem(10);
    let _view: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 0);
}

#[test]
#[should_panic(expected = "AttributesWriter::new | range")]
fn new_panics_if_start_index_crosses_bounds() {
    let mem = create_mem(32);
    let _view: AttributesWriter<'_, 16> = AttributesWriter::new(&mem, 20);
}
