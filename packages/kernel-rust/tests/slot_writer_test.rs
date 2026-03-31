use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
use symphonyscript_kernel::into_array::IntoArray;
use symphonyscript_kernel::slot_writer::SlotWriter;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

struct TestPayload {
    a: i32,
    b: i32,
}

impl IntoArray<16> for TestPayload {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];
        data[0] = self.a;
        data[1] = self.b;
        data
    }
}

// TB metadata = 4 slots, 3 buffers of 256 each = 4 + 768 = 772
// SimpleFreeList for capacity=8: head(1) + free_count(1) + bitmap(1) + slots(8) = 11
const SAB_SIZE: usize = 2048;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 256;
const FL_START: usize = 800;
const CAPACITY: i32 = 8;

fn setup() -> (SAB, symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter, symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader, SimpleFreeList) {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let free_list = SimpleFreeList::new(Arc::clone(&sab), FL_START, CAPACITY);
    (sab, writer, reader, free_list)
}

// ============ Construction ============

#[test]
fn new_creates_slot_writer() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);
    assert_eq!(sw.capacity(), CAPACITY);
}

#[test]
fn end_index_correct() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);
    assert_eq!(sw.end_index(), (CAPACITY as usize) * 16);
}

#[test]
fn resolve_writer_offset() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);
    assert_eq!(sw.resolve_writer_offset(0), 0);
    assert_eq!(sw.resolve_writer_offset(1), 16);
    assert_eq!(sw.resolve_writer_offset(3), 48);
}

#[test]
fn resolve_writer_offset_with_start_offset() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 100, CAPACITY);
    assert_eq!(sw.resolve_writer_offset(0), 100);
    assert_eq!(sw.resolve_writer_offset(1), 116);
}

// ============ Insert ============

#[test]
fn insert_returns_slot_index() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let slot = sw.insert(TestPayload { a: 42, b: 99 });
    assert!(slot.is_some());
}

#[test]
fn insert_writes_data_readable_via_get() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let slot = sw.insert(TestPayload { a: 42, b: 99 }).unwrap();
    let view = sw.get(slot);

    assert_eq!(view.read(0), 42);
    assert_eq!(view.read(1), 99);
    // remaining slots should be zero
    for i in 2..16 {
        assert_eq!(view.read(i), 0, "slot {} should be zero", i);
    }
}

#[test]
fn insert_exhausts_capacity_returns_none() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    for _ in 0..CAPACITY {
        assert!(sw.insert(TestPayload { a: 1, b: 2 }).is_some());
    }
    // 9th insert should fail
    assert!(sw.insert(TestPayload { a: 1, b: 2 }).is_none());
}

// ============ Free ============

#[test]
fn free_then_reinsert() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let slot = sw.insert(TestPayload { a: 10, b: 20 }).unwrap();
    sw.free(slot).unwrap();

    // Should be able to insert again
    let slot2 = sw.insert(TestPayload { a: 30, b: 40 }).unwrap();
    let view = sw.get(slot2);
    assert_eq!(view.read(0), 30);
    assert_eq!(view.read(1), 40);
}

// ============ write_field / read_field ============

#[test]
fn write_field_read_field_round_trip() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    sw.write_field(slot, 5, 999);
    assert_eq!(sw.read_field(slot, 5), 999);
}

#[test]
fn write_field_does_not_bleed() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    sw.write_field(slot, 0, i32::MAX);
    assert_eq!(sw.read_field(slot, 1), 0);
}

// ============ Multiple slots are independent ============

#[test]
fn multiple_slots_are_independent() {
    let (_sab, writer, _reader, free_list) = setup();
    let sw: SlotWriter<'_, 16> = SlotWriter::new(&writer, &free_list, 0, CAPACITY);

    let s0 = sw.insert(TestPayload { a: 100, b: 200 }).unwrap();
    let s1 = sw.insert(TestPayload { a: 300, b: 400 }).unwrap();

    assert_eq!(sw.read_field(s0, 0), 100);
    assert_eq!(sw.read_field(s1, 0), 300);
    assert_eq!(sw.read_field(s0, 1), 200);
    assert_eq!(sw.read_field(s1, 1), 400);
}
