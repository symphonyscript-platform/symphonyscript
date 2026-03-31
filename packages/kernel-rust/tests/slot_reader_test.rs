use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::slot_reader::SlotReader;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const SAB_SIZE: usize = 2048;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 256;
const CAPACITY: i32 = 8;

// ============ Construction ============

#[test]
fn new_creates_slot_reader() {
    let sab = create_sab(SAB_SIZE);
    let (_writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);
    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.capacity(), CAPACITY);
}

#[test]
fn end_index_correct() {
    let sab = create_sab(SAB_SIZE);
    let (_writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);
    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.end_index(), (CAPACITY as usize) * 16);
}

#[test]
fn resolve_reader_offset() {
    let sab = create_sab(SAB_SIZE);
    let (_writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);
    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.resolve_reader_offset(0), 0);
    assert_eq!(sr.resolve_reader_offset(1), 16);
    assert_eq!(sr.resolve_reader_offset(3), 48);
}

#[test]
fn resolve_reader_offset_with_start_offset() {
    let sab = create_sab(SAB_SIZE);
    let (_writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);
    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 50, CAPACITY);
    assert_eq!(sr.resolve_reader_offset(0), 50);
    assert_eq!(sr.resolve_reader_offset(1), 66);
}

// ============ Read via view ============

#[test]
fn get_returns_view_with_zero_defaults() {
    let sab = create_sab(SAB_SIZE);
    let (_writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);
    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);

    let view = sr.get(0);
    for i in 0..16 {
        assert_eq!(view.read(i), 0);
    }
}

// ============ Writer -> publish -> Reader round trip ============

#[test]
fn reads_published_data() {
    let sab = create_sab(SAB_SIZE);
    let (mut writer, mut reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);

    // Write at slot 0, field 0
    writer.write(0, 777);
    writer.write(1, 888);
    writer.publish();
    reader.swap();

    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.read_field(0, 0), 777);
    assert_eq!(sr.read_field(0, 1), 888);
}

#[test]
fn reads_published_data_via_view() {
    let sab = create_sab(SAB_SIZE);
    let (mut writer, mut reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);

    writer.write(0, 111);
    writer.write(16, 222);
    writer.publish();
    reader.swap();

    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    let v0 = sr.get(0);
    let v1 = sr.get(1);

    assert_eq!(v0.read(0), 111);
    assert_eq!(v1.read(0), 222);
}

#[test]
fn slots_are_independent() {
    let sab = create_sab(SAB_SIZE);
    let (mut writer, mut reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);

    // Write to slot 0 field 0 and slot 2 field 0
    writer.write(0, 100);
    writer.write(32, 300); // slot 2 * 16
    writer.publish();
    reader.swap();

    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.read_field(0, 0), 100);
    assert_eq!(sr.read_field(1, 0), 0); // untouched slot
    assert_eq!(sr.read_field(2, 0), 300);
}

#[test]
fn does_not_see_unpublished_writes() {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);

    writer.write(0, 999);
    // no publish, no swap

    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);
    assert_eq!(sr.read_field(0, 0), 0); // reader hasn't seen it
}
