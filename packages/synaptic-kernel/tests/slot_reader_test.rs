use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::topology::slot_reader::SlotReader;

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
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let reader = writer.to_reader();
    let view: SlotReader<'_, 16> = SlotReader::new(&reader, 0);
    assert_eq!(view.read(0), 0);
}

#[test]
fn read_returns_zero_on_fresh_mem() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 256);
    let reader = writer.to_reader();
    let view: SlotReader<'_, 16> = SlotReader::new(&reader, 0);

    for i in 0..16 {
        assert_eq!(view.read(i), 0);
    }
}

#[test]
fn read_at_nonzero_offset() {
    let mem = create_mem(1024);
    let mut writer = TripleBufferWriter::new(mem, 0, 256);
    let mut reader = writer.to_reader();

    // Write at offset 32 (slot 2 if SLOT_SIZE=16)
    writer.write(32, 777);
    writer.publish();
    reader.swap();

    let view: SlotReader<'_, 16> = SlotReader::new(&reader, 32);
    assert_eq!(view.read(0), 777);
}

#[test]
fn reads_are_isolated_between_slots() {
    let mem = create_mem(1024);
    let mut writer = TripleBufferWriter::new(mem, 0, 256);
    let mut reader = writer.to_reader();

    writer.write(0, 100);
    writer.write(16, 200);
    writer.publish();
    reader.swap();

    let view_a: SlotReader<'_, 16> = SlotReader::new(&reader, 0);
    let view_b: SlotReader<'_, 16> = SlotReader::new(&reader, 16);

    assert_eq!(view_a.read(0), 100);
    assert_eq!(view_b.read(0), 200);
}

#[test]
#[should_panic(expected = "SlotReader::create | range")]
fn panics_if_out_of_bounds() {
    let mem = create_mem(1024);
    let writer = TripleBufferWriter::new(mem, 0, 16);
    let reader = writer.to_reader();
    // 16 buffer capacity, start at 8, SLOT_SIZE=16 => 8+16=24 > 16
    let _view: SlotReader<'_, 16> = SlotReader::new(&reader, 8);
}
