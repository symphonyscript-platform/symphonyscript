use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn new_creates_view_at_start_index() {
    let sab = create_sab(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 0);
    
    for i in 0..16 {
        assert_eq!(view.read(i), 0);
    }
}

#[test]
fn raw_read_write_round_trip() {
    let sab = create_sab(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 10);
    
    view.write(0, 500);
    view.write(15, -42);
    
    assert_eq!(view.read(0), 500);
    assert_eq!(view.read(15), -42);
}

#[test]
fn fields_do_not_bleed() {
    let sab = create_sab(128);
    let view: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 0);
    
    view.write(0, i32::MAX);
    assert_eq!(view.read(1), 0);
    
    view.write(1, i32::MIN);
    assert_eq!(view.read(0), i32::MAX);
}

#[test]
fn two_views_different_offsets_are_independent() {
    let sab = create_sab(128);
    let view_a: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 0);
    let view_b: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 16);
    
    view_a.write(0, 100);
    view_b.write(0, 200);
    
    assert_eq!(view_a.read(0), 100);
    assert_eq!(view_b.read(0), 200);
}

#[test]
fn two_views_share_sab_see_writes() {
    let sab = create_sab(128);
    let view_a: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 10);
    let view_b: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 10);
    
    view_a.write(5, 999);
    assert_eq!(view_b.read(5), 999);
}

#[test]
fn works_with_different_slot_sizes() {
    let sab = create_sab(128);
    let view_8: AttributesWriter<'_, 8> = AttributesWriter::new(&sab, 0);
    let view_16: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 64);
    
    view_8.write(0, 111);
    view_16.write(0, 222);
    
    assert_eq!(view_8.read(0), 111);
    assert_eq!(view_16.read(0), 222);
}

#[test]
#[should_panic(expected = "NodeAttributesView out of bounds")]
fn new_panics_if_out_of_bounds() {
    let sab = create_sab(10);
    let _view: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 0);
}

#[test]
#[should_panic(expected = "NodeAttributesView out of bounds")]
fn new_panics_if_start_index_crosses_bounds() {
    let sab = create_sab(32);
    let _view: AttributesWriter<'_, 16> = AttributesWriter::new(&sab, 20);
}
