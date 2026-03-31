use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::slot_write_view::SlotWriteView;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ Construction ============

#[test]
fn new_creates_view() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);
    assert_eq!(view.read(0), 0);
}

// ============ Read/Write ============

#[test]
fn write_then_read_round_trip() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);

    view.write(0, 42);
    assert_eq!(view.read(0), 42);
}

#[test]
fn write_all_slots() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);

    for i in 0..16 {
        view.write(i, (i as i32) * 100);
    }

    for i in 0..16 {
        assert_eq!(view.read(i), (i as i32) * 100);
    }
}

#[test]
fn fields_do_not_bleed() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);

    view.write(0, i32::MAX);
    assert_eq!(view.read(1), 0);
    assert_eq!(view.read(15), 0);
}

#[test]
fn overwrite_replaces_value() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);

    view.write(0, 100);
    view.write(0, 200);
    assert_eq!(view.read(0), 200);
}

#[test]
fn two_views_different_offsets_are_independent() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view_a: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);
    let view_b: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 16);

    view_a.write(0, 111);
    view_b.write(0, 222);

    assert_eq!(view_a.read(0), 111);
    assert_eq!(view_b.read(0), 222);
}

#[test]
fn negative_values_preserved() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 0);

    view.write(0, -999);
    view.write(1, i32::MIN);
    assert_eq!(view.read(0), -999);
    assert_eq!(view.read(1), i32::MIN);
}

#[test]
#[should_panic(expected = "SlotView out of bounds")]
fn panics_if_out_of_bounds() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 16);
    let _view: SlotWriteView<'_, 16> = SlotWriteView::new(&writer, 8);
}
