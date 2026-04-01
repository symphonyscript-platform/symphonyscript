use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::structural_plane::slot_writer::SlotWriter;

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
    let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);
    assert_eq!(view.read(0), 0);
}

// ============ Read/Write ============

#[test]
#[should_panic(expected = "SlotWriter out of bounds")]
fn panics_if_out_of_bounds() {
    let sab = create_sab(1024);
    let (writer, _reader) = TripleBuffer::new(sab, 0, 16);
    let _view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 8);
}
