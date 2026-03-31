use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::slot_readonly_view::SlotReadonlyView;

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
    let (_writer, reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 0);
    assert_eq!(view.read(0), 0);
}

#[test]
fn read_returns_zero_on_fresh_sab() {
    let sab = create_sab(1024);
    let (_writer, reader) = TripleBuffer::new(sab, 0, 256);
    let view: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 0);

    for i in 0..16 {
        assert_eq!(view.read(i), 0);
    }
}

#[test]
fn read_at_nonzero_offset() {
    let sab = create_sab(1024);
    let (mut writer, mut reader) = TripleBuffer::new(sab, 0, 256);

    // Write at offset 32 (slot 2 if SLOT_SIZE=16)
    writer.write(32, 777);
    writer.publish();
    reader.swap();

    let view: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 32);
    assert_eq!(view.read(0), 777);
}

#[test]
fn reads_are_isolated_between_slots() {
    let sab = create_sab(1024);
    let (mut writer, mut reader) = TripleBuffer::new(sab, 0, 256);

    writer.write(0, 100);
    writer.write(16, 200);
    writer.publish();
    reader.swap();

    let view_a: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 0);
    let view_b: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 16);

    assert_eq!(view_a.read(0), 100);
    assert_eq!(view_b.read(0), 200);
}

#[test]
#[should_panic(expected = "SlotReadonlyView out of bounds")]
fn panics_if_out_of_bounds() {
    let sab = create_sab(1024);
    let (_writer, reader) = TripleBuffer::new(sab, 0, 16);
    // 16 buffer capacity, start at 8, SLOT_SIZE=16 => 8+16=24 > 16
    let _view: SlotReadonlyView<'_, 16> = SlotReadonlyView::new(&reader, 8);
}
