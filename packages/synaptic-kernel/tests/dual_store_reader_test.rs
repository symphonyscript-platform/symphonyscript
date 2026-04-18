use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::dual_store_reader::DualStoreReader;
use synaptic_kernel::primitives::dual_store_writer::DualStoreWriter;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const TB_BUFFER_CAPACITY: usize = 1024;
const TB_MEM_RESERVED: usize = 4 + TB_BUFFER_CAPACITY * 3;
const DEFAULT_MEM_START_OFFSET: usize = TB_MEM_RESERVED + 8;
const MEM_SIZE: usize = 16384;

fn make_tb(mem: &AtomicBuffer) -> TripleBufferWriter {
    TripleBufferWriter::new(Arc::clone(mem), 0, TB_BUFFER_CAPACITY)
}

// ============ Construction via writer.to_reader() ============

#[test]
fn to_reader_produces_matching_reader() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let reader = store.to_reader();
    assert_eq!(reader.capacity(), store.capacity());
    assert_eq!(reader.mem_start_offset(), store.mem_start_offset());
    assert_eq!(reader.mem_end_offset(), store.mem_end_offset());
    assert_eq!(reader.tb_start_offset(), store.tb_start_offset());
    assert_eq!(reader.tb_end_offset(), store.tb_end_offset());
}

#[test]
fn calculate_size_matches_writer() {
    assert_eq!(
        DualStoreReader::<8, 16>::calculate_size_on_mem(16),
        DualStoreWriter::<8, 16>::calculate_size_on_mem(16),
    );
    assert_eq!(
        DualStoreReader::<8, 16>::calculate_size_on_tb(16),
        DualStoreWriter::<8, 16>::calculate_size_on_tb(16),
    );
    assert_eq!(
        DualStoreReader::<4, 32>::calculate_size_on_mem(64),
        DualStoreWriter::<4, 32>::calculate_size_on_mem(64),
    );
    assert_eq!(
        DualStoreReader::<4, 32>::calculate_size_on_tb(64),
        DualStoreWriter::<4, 32>::calculate_size_on_tb(64),
    );
}

// ============ Struct plane read (requires TB publish + swap) ============

#[test]
fn struct_read_after_publish_and_swap() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    // External TripleBufferReader: DualStoreReader has no swap() method,
    // but the reader buffer id lives in shared mem, so an external swap()
    // advances the shared reader buffer that DualStoreReader reads from.
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    let data = [11, 22, 33, 44, 55, 66, 77, 88];
    store.struct_write_all(s, data);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.struct_read_all(s), data);
    for (i, expected) in data.iter().enumerate() {
        assert_eq!(reader.struct_read(s, i), *expected);
    }
}

#[test]
fn struct_reads_isolated_per_slot_on_reader_side() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    store.struct_write_all(s1, [1, 1, 1, 1, 1, 1, 1, 1]);
    store.struct_write_all(s2, [2, 2, 2, 2, 2, 2, 2, 2]);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.struct_read_all(s1), [1; 8]);
    assert_eq!(reader.struct_read_all(s2), [2; 8]);
}

#[test]
fn struct_reader_handle_from_get_struct() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    store.struct_write_all(s, [100, 200, 300, 400, 500, 600, 700, 800]);
    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    let handle = reader.get_struct(s);
    assert_eq!(handle.read(0), 100);
    assert_eq!(handle.read(3), 400);
    assert_eq!(handle.read(7), 800);
    assert_eq!(handle.read_all(), [100, 200, 300, 400, 500, 600, 700, 800]);
}

// ============ Attribute plane read (instantly visible) ============

#[test]
fn attr_read_visible_without_publish() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    store.attr_write(s, 0, 1234);
    store.attr_write(s, 15, -42);

    let reader = store.to_reader();
    // No publish, no swap — mem plane writes are immediately visible.
    assert_eq!(reader.attr_read(s, 0), 1234);
    assert_eq!(reader.attr_read(s, 15), -42);
}

#[test]
fn attr_read_all_visible_without_publish() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    let mut data: [i32; 16] = [0; 16];
    for i in 0..16 {
        data[i] = (i as i32) * 13 - 7;
    }
    store.attr_write_all(s, data);

    let reader = store.to_reader();
    assert_eq!(reader.attr_read_all(s), data);
}

// ============ Multiple readers share state ============

#[test]
fn multiple_readers_share_underlying_state() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    store.attr_write(s, 0, 999);
    store.struct_write(s, 0, 7);
    tb.publish();
    assert!(tb_reader.swap());

    let reader_a = store.to_reader();
    let reader_b = store.to_reader();

    // Both readers observe the same published struct and attr data.
    assert_eq!(reader_a.attr_read(s, 0), 999);
    assert_eq!(reader_b.attr_read(s, 0), 999);
    assert_eq!(reader_a.struct_read(s, 0), 7);
    assert_eq!(reader_b.struct_read(s, 0), 7);

    // A subsequent writer-side attr update (mem plane) is visible to both.
    store.attr_write(s, 0, -1);
    assert_eq!(reader_a.attr_read(s, 0), -1);
    assert_eq!(reader_b.attr_read(s, 0), -1);
}

// ============ Cross-configuration combinations ============

#[test]
fn reader_roundtrip_with_1_1_1_config() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<1, 1>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        1,
    );

    let s = store.insert_struct().unwrap();
    store.struct_write(s, 0, 5);
    store.attr_write(s, 0, 6);
    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.struct_read(s, 0), 5);
    assert_eq!(reader.attr_read(s, 0), 6);
}

#[test]
fn reader_offsets_for_nonzero_start_offsets() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let mem_start = DEFAULT_MEM_START_OFFSET + 128;
    let tb_start = 64;
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        mem_start,
        tb_start,
        4,
    );
    let reader = store.to_reader();

    assert_eq!(reader.mem_start_offset(), mem_start);
    assert_eq!(reader.tb_start_offset(), tb_start);
    assert_eq!(
        reader.tb_end_offset() - reader.tb_start_offset(),
        DualStoreReader::<8, 16>::calculate_size_on_tb(4)
    );
    assert_eq!(
        reader.mem_end_offset() - reader.mem_start_offset(),
        DualStoreReader::<8, 16>::calculate_size_on_mem(4)
    );
}
