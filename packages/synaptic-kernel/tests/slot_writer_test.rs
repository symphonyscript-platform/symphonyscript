use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::slot_writer::SlotWriter;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ Construction ============

#[test]
fn new_creates_view() {
    let mem = create_mem(1024);
    let (writer, _reader) = TripleBufferWriter::new(mem, 0, 256);
    let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);
    assert_eq!(view.read(0), 0);
}

// ============ Read/Write ============

#[test]
#[should_panic(expected = "SlotWriter::create | range")]
fn panics_if_out_of_bounds() {
    let mem = create_mem(1024);
    let (writer, _reader) = TripleBufferWriter::new(mem, 0, 16);
    let _view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 8);
}
