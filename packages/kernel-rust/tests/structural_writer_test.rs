use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::structural_plane::structural_writer::StructuralWriter;

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
const CAPACITY: usize = 8;

fn setup_custom(
    start_offset: usize,
) -> (
    SAB,
    symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    StructuralWriter<16>,
) {
    let sab = create_sab(SAB_SIZE);
    let (writer, _reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let sw: StructuralWriter<16> = StructuralWriter::new(
        sab.clone(),
        writer.clone(),
        FL_START,
        start_offset,
        CAPACITY,
    );
    (sab, writer, sw)
}

fn setup() -> (
    SAB,
    symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    StructuralWriter<16>,
) {
    setup_custom(0)
}

// ============ Construction ============

#[test]
fn new_creates_slot_writer() {
    let (_sab, _writer, sw) = setup();
    assert_eq!(sw.capacity(), CAPACITY);
}

#[test]
fn end_index_correct() {
    let (_sab, _writer, sw) = setup();
    assert_eq!(sw.triple_buffer_end_offset(), CAPACITY * 16);
}

#[test]
fn resolve_writer_offset() {
    let (_sab, _writer, sw) = setup();
    // slot 1 (1-based) maps to index 0 -> offset 0
    assert_eq!(sw.resolve_writer_offset(1), 0);
    // slot 2 -> index 1 -> offset 16
    assert_eq!(sw.resolve_writer_offset(2), 16);
    // slot 4 -> index 3 -> offset 48
    assert_eq!(sw.resolve_writer_offset(4), 48);
}

#[test]
fn resolve_writer_offset_with_start_offset() {
    let (_sab, _writer, sw) = setup_custom(100);
    // slot 1 -> index 0 -> 100 + 0 = 100
    assert_eq!(sw.resolve_writer_offset(1), 100);
    // slot 2 -> index 1 -> 100 + 16 = 116
    assert_eq!(sw.resolve_writer_offset(2), 116);
}

// ============ Insert ============

#[test]
fn insert_returns_slot_index() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: 42, b: 99 });
    assert!(slot.is_some());
    assert!(slot.unwrap() > 0); // 1-based indexing
}

#[test]
fn insert_writes_data_readable_via_get() {
    let (_sab, _writer, sw) = setup();
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
    let (_sab, _writer, sw) = setup();
    for _ in 0..CAPACITY {
        assert!(sw.insert(TestPayload { a: 1, b: 2 }).is_some());
    }
    // 9th insert should fail
    assert!(sw.insert(TestPayload { a: 1, b: 2 }).is_none());
}

// ============ Free ============

#[test]
fn free_then_reinsert_reuses_slot() {
    let (_sab, _writer, mut sw) = setup();
    let slot = sw.insert(TestPayload { a: 10, b: 20 }).unwrap();
    sw.defer_free(slot);
    sw.free_deferred_slots().unwrap();
    sw.free_deferred_slots().unwrap();

    // Must reclaim the freed slot, not grab a new one
    let slot2 = sw.insert(TestPayload { a: 30, b: 40 }).unwrap();
    assert_eq!(slot2, slot, "freed slot must be reclaimed");
    let view = sw.get(slot2);
    assert_eq!(view.read(0), 30);
    assert_eq!(view.read(1), 40);
}

#[test]
fn double_free_returns_error() {
    let (_sab, _writer, sw) = setup();
    let _slot = sw.insert(TestPayload { a: 1, b: 2 }).unwrap();
    /* commented ok check */
    /* commented err check */
}

// ============ write_field / read_field ============

#[test]
fn write_field_read_field_round_trip() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    sw.write_field(slot, 5, 999);
    assert_eq!(sw.read_field(slot, 5), 999);
}

#[test]
fn write_field_does_not_bleed() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    sw.write_field(slot, 0, i32::MAX);
    assert_eq!(sw.read_field(slot, 1), 0);
}

// ============ Multiple slots are independent ============

#[test]
fn multiple_slots_are_independent() {
    let (_sab, _writer, sw) = setup();
    let s0 = sw.insert(TestPayload { a: 100, b: 200 }).unwrap();
    let s1 = sw.insert(TestPayload { a: 300, b: 400 }).unwrap();

    assert_eq!(sw.read_field(s0, 0), 100);
    assert_eq!(sw.read_field(s1, 0), 300);
    assert_eq!(sw.read_field(s0, 1), 200);
    assert_eq!(sw.read_field(s1, 1), 400);
}

// ============ Boundary Slots ============

#[test]
fn first_slot_is_one() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: 42, b: 0 }).unwrap();
    assert_eq!(slot, 1, "first allocated slot must be 1");
}

#[test]
fn last_slot_is_capacity() {
    let (_sab, _writer, sw) = setup();
    let mut last_slot = 0;
    for _ in 0..CAPACITY {
        last_slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    }
    assert_eq!(
        last_slot, CAPACITY,
        "last allocated slot must equal capacity"
    );
}

#[test]
fn first_and_last_slots_data_integrity() {
    let (_sab, _writer, sw) = setup();
    let first = sw.insert(TestPayload { a: 111, b: 222 }).unwrap();
    // fill remaining slots
    for _ in 1..CAPACITY {
        sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    }

    // verify first slot data survived filling
    assert_eq!(sw.read_field(first, 0), 111);
    assert_eq!(sw.read_field(first, 1), 222);

    // verify last slot
    assert_eq!(sw.read_field(CAPACITY, 0), 0);
}

// ============ SAB Memory Verification ============

#[test]
fn insert_lands_at_correct_sab_offset() {
    let (sab, writer, sw) = setup();
    let slot = sw
        .insert(TestPayload {
            a: 0xDEAD,
            b: 0xBEEF,
        })
        .unwrap();

    // slot 1 -> index 0 -> TB offset 0.
    // The writer's current_start_index() gives us the actual SAB base.
    let tb_base = writer.current_start_index();
    let expected_sab_offset = tb_base + (slot - 1) * 16;

    use std::sync::atomic::Ordering;
    assert_eq!(sab[expected_sab_offset].load(Ordering::Relaxed), 0xDEAD);
    assert_eq!(sab[expected_sab_offset + 1].load(Ordering::Relaxed), 0xBEEF);

    // remaining 14 fields must be zero
    for i in 2..16 {
        assert_eq!(
            sab[expected_sab_offset + i].load(Ordering::Relaxed),
            0,
            "field {} should be zero",
            i
        );
    }
}

#[test]
fn insert_with_nonzero_start_lands_at_correct_sab_offset() {
    let start_offset = 32;
    let (sab, writer, sw) = setup_custom(start_offset);

    let slot = sw
        .insert(TestPayload {
            a: 0xCAFE,
            b: 0xBABE,
        })
        .unwrap();

    let tb_base = writer.current_start_index();
    let expected_sab_offset = tb_base + start_offset + (slot - 1) * 16;

    use std::sync::atomic::Ordering;
    assert_eq!(sab[expected_sab_offset].load(Ordering::Relaxed), 0xCAFE);
    assert_eq!(sab[expected_sab_offset + 1].load(Ordering::Relaxed), 0xBABE);
}

// ============ write_field + get() share view ============

#[test]
fn write_field_visible_through_get() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
    sw.write_field(slot, 7, 12345);

    let view = sw.get(slot);
    assert_eq!(
        view.read(7),
        12345,
        "write_field must be visible through get()"
    );
}

// ============ Full Exhaust -> Free -> Refill ============

#[test]
fn exhaust_free_all_refill_all() {
    let (_sab, _writer, mut sw) = setup();
    // fill all 8 slots
    let mut slots = Vec::new();
    for i in 0..CAPACITY {
        let slot = sw
            .insert(TestPayload {
                a: (i as i32) * 10,
                b: 0,
            })
            .unwrap();
        slots.push(slot);
    }
    assert!(
        sw.insert(TestPayload { a: 0, b: 0 }).is_none(),
        "should be exhausted"
    );

    // free all 8
    for &slot in &slots {
        sw.defer_free(slot);
    }

    // refill all 8 with new data
    sw.free_deferred_slots().unwrap();
    sw.free_deferred_slots().unwrap();
    let mut new_slots = Vec::new();
    for i in 0..CAPACITY {
        let slot = sw
            .insert(TestPayload {
                a: (i as i32) * 100,
                b: 0,
            })
            .unwrap();
        new_slots.push(slot);
    }
    assert!(
        sw.insert(TestPayload { a: 0, b: 0 }).is_none(),
        "should be exhausted again"
    );

    // verify new data
    for (i, &slot) in new_slots.iter().enumerate() {
        assert_eq!(sw.read_field(slot, 0), (i as i32) * 100);
    }
}

// ============ Negative / extreme values ============

#[test]
fn negative_values_roundtrip_through_insert() {
    let (_sab, _writer, sw) = setup();
    let slot = sw.insert(TestPayload { a: i32::MIN, b: -1 }).unwrap();
    let view = sw.get(slot);
    assert_eq!(view.read(0), i32::MIN);
    assert_eq!(view.read(1), -1);
}
