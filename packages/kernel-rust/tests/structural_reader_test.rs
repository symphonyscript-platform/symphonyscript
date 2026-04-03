use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::structural_plane::structural_reader::StructuralReader;
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

const SAB_SIZE: usize = 2048;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 256;
const FL_START: usize = 800;
const CAPACITY: usize = 8;

fn setup() -> (
    SAB,
    symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader,
    SimpleFreeList,
    symphonyscript_kernel::primitives::deferred_frees_list::DeferredFreesList,
) {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let free_list = SimpleFreeList::new(Arc::clone(&sab), FL_START, CAPACITY);
    let deferred = symphonyscript_kernel::primitives::deferred_frees_list::DeferredFreesList::new(
        Arc::clone(&sab),
        FL_START + 500,
        CAPACITY,
    );
    (sab, writer, reader, free_list, deferred)
}

// ============ Construction ============

#[test]
fn new_creates_structural_reader() {
    let (_sab, _writer, reader, _free_list, deferred) = setup();
    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.capacity(), CAPACITY);
}

#[test]
fn end_index_correct() {
    let (_sab, _writer, reader, _free_list, deferred) = setup();
    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.end_offset(), CAPACITY * 16);
}

#[test]
fn resolve_reader_offset() {
    let (_sab, _writer, reader, _free_list, deferred) = setup();
    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    // slot 1 (1-based) -> index 0 -> offset 0
    assert_eq!(sr.resolve_reader_offset(1), 0);
    // slot 2 -> index 1 -> offset 16
    assert_eq!(sr.resolve_reader_offset(2), 16);
    // slot 4 -> index 3 -> offset 48
    assert_eq!(sr.resolve_reader_offset(4), 48);
}

#[test]
fn resolve_reader_offset_with_start_offset() {
    let (_sab, _writer, reader, _free_list, deferred) = setup();
    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 50, CAPACITY);
    // slot 1 -> index 0 -> 50 + 0 = 50
    assert_eq!(sr.resolve_reader_offset(1), 50);
    // slot 2 -> index 1 -> 50 + 16 = 66
    assert_eq!(sr.resolve_reader_offset(2), 66);
}

// ============ Writer -> publish -> Reader round-trip ============

#[test]
fn reads_published_data_via_writer_round_trip() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();
    let sw: StructuralWriter<16> = StructuralWriter::new(
        writer.clone(),
        free_list.clone(),
        deferred.clone(),
        0,
        CAPACITY,
    );

    let slot = sw.insert(TestPayload { a: 777, b: 888 }).unwrap();
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.read_field(slot, 0), 777);
    assert_eq!(sr.read_field(slot, 1), 888);
}

#[test]
fn reads_published_data_via_view() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();
    let sw: StructuralWriter<16> = StructuralWriter::new(
        writer.clone(),
        free_list.clone(),
        deferred.clone(),
        0,
        CAPACITY,
    );

    let slot1 = sw.insert(TestPayload { a: 111, b: 0 }).unwrap();
    let slot2 = sw.insert(TestPayload { a: 222, b: 0 }).unwrap();
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    let v1 = sr.get(slot1);
    let v2 = sr.get(slot2);

    assert_eq!(v1.read(0), 111);
    assert_eq!(v2.read(0), 222);
}

#[test]
fn slots_are_independent() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();
    let sw: StructuralWriter<16> = StructuralWriter::new(
        writer.clone(),
        free_list.clone(),
        deferred.clone(),
        0,
        CAPACITY,
    );

    let slot1 = sw.insert(TestPayload { a: 100, b: 0 }).unwrap();
    let slot2 = sw.insert(TestPayload { a: 0, b: 0 }).unwrap(); // untouched
    let slot3 = sw.insert(TestPayload { a: 300, b: 0 }).unwrap();
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.read_field(slot1, 0), 100);
    assert_eq!(sr.read_field(slot2, 0), 0);
    assert_eq!(sr.read_field(slot3, 0), 300);
}

#[test]
fn does_not_see_unpublished_writes() {
    let (_sab, writer, reader, free_list, deferred) = setup();
    let sw: StructuralWriter<16> = StructuralWriter::new(
        writer.clone(),
        free_list.clone(),
        deferred.clone(),
        0,
        CAPACITY,
    );

    let slot = sw.insert(TestPayload { a: 999, b: 0 }).unwrap();
    // no publish, no swap

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.read_field(slot, 0), 0); // reader hasn't seen it
}

#[test]
fn get_returns_view_with_zero_defaults() {
    let (_sab, _writer, reader, _free_list, deferred) = setup();
    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);

    let view = sr.get(1); // 1-based: first real slot
    for i in 0..16 {
        assert_eq!(view.read(i), 0);
    }
}

// ============ Multi-cycle publish/swap ============

#[test]
fn reader_sees_updated_data_after_second_publish_swap() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();

    // cycle 1: insert and publish
    let slot = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        let slot = sw.insert(TestPayload { a: 100, b: 200 }).unwrap();
        slot
    };
    writer.publish();
    reader.swap();

    {
        let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
        assert_eq!(sr.read_field(slot, 0), 100);
    }

    // cycle 2: mutate the same slot, publish again
    {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        sw.write_field(slot, 0, 999);
    }
    writer.publish();
    reader.swap();

    {
        let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
        assert_eq!(sr.read_field(slot, 0), 999);
    }
}

#[test]
fn reader_retains_old_data_without_swap() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();

    let slot = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        sw.insert(TestPayload { a: 42, b: 0 }).unwrap()
    };
    writer.publish();
    reader.swap();

    // writer updates + publishes, but reader does NOT swap
    {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        sw.write_field(slot, 0, 999);
    }
    writer.publish();

    // reader still sees old value (no swap)
    {
        let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
        assert_eq!(sr.read_field(slot, 0), 42);
    }
}

// ============ Non-zero start_offset round-trip ============

#[test]
fn nonzero_start_offset_full_round_trip() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();
    let start_offset = 48;

    let slot = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            start_offset,
            CAPACITY,
        );
        sw.insert(TestPayload {
            a: 0xABCD,
            b: 0x1234,
        })
        .unwrap()
    };
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), start_offset, CAPACITY);
    assert_eq!(sr.read_field(slot, 0), 0xABCD);
    assert_eq!(sr.read_field(slot, 1), 0x1234);
}

// ============ SAB Memory Verification ============

#[test]
fn reader_reads_from_correct_sab_offset() {
    let (sab, mut writer, mut reader, free_list, deferred) = setup();

    let slot = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        sw.insert(TestPayload {
            a: 0xFACE,
            b: 0xFEED,
        })
        .unwrap()
    };
    writer.publish();
    reader.swap();

    // verify the reader's SAB buffer actually contains the data
    let reader_base = reader.current_start_index();
    let expected_offset = reader_base + (slot - 1) * 16;

    use std::sync::atomic::Ordering;
    assert_eq!(sab[expected_offset].load(Ordering::Relaxed), 0xFACE);
    assert_eq!(sab[expected_offset + 1].load(Ordering::Relaxed), 0xFEED);
}

// ============ Boundary Slots ============

#[test]
fn reader_sees_first_and_last_slot() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();

    let first = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        let first = sw.insert(TestPayload { a: 111, b: 0 }).unwrap();
        // fill remaining
        for _ in 1..CAPACITY {
            sw.insert(TestPayload { a: 0, b: 0 }).unwrap();
        }
        // overwrite last slot's data
        sw.write_field(CAPACITY, 0, 888);
        first
    };
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    assert_eq!(sr.read_field(first, 0), 111, "first slot");
    assert_eq!(sr.read_field(CAPACITY, 0), 888, "last slot");
}

// ============ Multiple readers see same snapshot ============

#[test]
fn two_reader_views_same_snapshot() {
    let (_sab, mut writer, mut reader, free_list, deferred) = setup();

    let slot = {
        let sw: StructuralWriter<16> = StructuralWriter::new(
            writer.clone(),
            free_list.clone(),
            deferred.clone(),
            0,
            CAPACITY,
        );
        sw.insert(TestPayload { a: 77, b: 88 }).unwrap()
    };
    writer.publish();
    reader.swap();

    let sr: StructuralReader<16> = StructuralReader::new(reader.clone(), 0, CAPACITY);
    let v1 = sr.get(slot);
    let v2 = sr.get(slot);

    assert_eq!(v1.read(0), v2.read(0));
    assert_eq!(v1.read(1), v2.read(1));
}
