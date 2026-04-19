use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;
use synaptic_kernel::primitives::entry_store_reader::EntryStoreReader;
use synaptic_kernel::primitives::entry_store_writer::EntryStoreWriter;
use synaptic_kernel::primitives::slot_allocator::SlotAllocator;
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
    let store = EntryStoreWriter::<8, 0, 16>::new(
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
        EntryStoreReader::<8, 0, 16>::calculate_size_on_mem(16),
        EntryStoreWriter::<8, 0, 16>::calculate_size_on_mem(16),
    );
    assert_eq!(
        EntryStoreReader::<8, 0, 16>::calculate_size_on_tb(16),
        EntryStoreWriter::<8, 0, 16>::calculate_size_on_tb(16),
    );
    assert_eq!(
        EntryStoreReader::<4, 0, 32>::calculate_size_on_mem(64),
        EntryStoreWriter::<4, 0, 32>::calculate_size_on_mem(64),
    );
    assert_eq!(
        EntryStoreReader::<4, 0, 32>::calculate_size_on_tb(64),
        EntryStoreWriter::<4, 0, 32>::calculate_size_on_tb(64),
    );
}

// ============ Struct plane read (requires TB publish + swap) ============

#[test]
fn struct_read_after_publish_and_swap() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    // External TripleBufferReader: EntryStoreReader has no swap() method,
    // but the reader buffer id lives in shared mem, so an external swap()
    // advances the shared reader buffer that EntryStoreReader reads from.
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert().unwrap();
    let data = [11, 22, 33, 44, 55, 66, 77, 88];
    store.get(s).core_write_all(data);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s).core_read_all(), data);
    for (i, expected) in data.iter().enumerate() {
        assert_eq!(reader.get(s).core_read(i), *expected);
    }
}

#[test]
fn struct_reads_isolated_per_slot_on_reader_side() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    store.get(s1).core_write_all([1, 1, 1, 1, 1, 1, 1, 1]);
    store.get(s2).core_write_all([2, 2, 2, 2, 2, 2, 2, 2]);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s1).core_read_all(), [1; 8]);
    assert_eq!(reader.get(s2).core_read_all(), [2; 8]);
}

#[test]
fn struct_reader_handle_from_get_struct() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert().unwrap();
    store.get(s).core_write_all([100, 200, 300, 400, 500, 600, 700, 800]);
    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    let handle = reader.get(s);
    assert_eq!(handle.core_read(0), 100);
    assert_eq!(handle.core_read(3), 400);
    assert_eq!(handle.core_read(7), 800);
    assert_eq!(handle.core_read_all(), [100, 200, 300, 400, 500, 600, 700, 800]);
}

// ============ Attribute plane read (instantly visible) ============

#[test]
fn attr_read_visible_without_publish() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert().unwrap();
    store.get(s).attr_write(0, 1234);
    store.get(s).attr_write(15, -42);

    let reader = store.to_reader();
    // No publish, no swap — mem plane writes are immediately visible.
    assert_eq!(reader.get(s).attr_read(0), 1234);
    assert_eq!(reader.get(s).attr_read(15), -42);
}

#[test]
fn attr_read_all_visible_without_publish() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert().unwrap();
    let mut data: [i32; 16] = [0; 16];
    for i in 0..16 {
        data[i] = (i as i32) * 13 - 7;
    }
    store.get(s).attr_write_all(data);

    let reader = store.to_reader();
    assert_eq!(reader.get(s).attr_read_all(), data);
}

// ============ Multiple readers share state ============

#[test]
fn multiple_readers_share_underlying_state() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert().unwrap();
    store.get(s).attr_write(0, 999);
    store.get(s).core_write(0, 7);
    tb.publish();
    assert!(tb_reader.swap());

    let reader_a = store.to_reader();
    let reader_b = store.to_reader();

    // Both readers observe the same published struct and attr data.
    assert_eq!(reader_a.get(s).attr_read(0), 999);
    assert_eq!(reader_b.get(s).attr_read(0), 999);
    assert_eq!(reader_a.get(s).core_read(0), 7);
    assert_eq!(reader_b.get(s).core_read(0), 7);

    // A subsequent writer-side attr update (mem plane) is visible to both.
    store.get(s).attr_write(0, -1);
    assert_eq!(reader_a.get(s).attr_read(0), -1);
    assert_eq!(reader_b.get(s).attr_read(0), -1);
}

// ============ Cross-configuration combinations ============

#[test]
fn reader_roundtrip_with_1_1_1_config() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<1, 0, 1>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        1,
    );

    let s = store.insert().unwrap();
    store.get(s).core_write(0, 5);
    store.get(s).attr_write(0, 6);
    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s).core_read(0), 5);
    assert_eq!(reader.get(s).attr_read(0), 6);
}

#[test]
fn reader_offsets_for_nonzero_start_offsets() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let mem_start = DEFAULT_MEM_START_OFFSET + 128;
    let tb_start = 64;
    let store = EntryStoreWriter::<8, 0, 16>::new(
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
        EntryStoreReader::<8, 0, 16>::calculate_size_on_tb(4)
    );
    assert_eq!(
        reader.mem_end_offset() - reader.mem_start_offset(),
        EntryStoreReader::<8, 0, 16>::calculate_size_on_mem(4)
    );
}

// ============ Cross-layer layout verification ============
//
// These tests verify that the reader resolves struct-plane and attribute-plane
// offsets to the same absolute memory locations predicted by the documented
// layout formulas. One side of each assertion uses the EntryStoreReader API;
// the other side reads from the raw TripleBufferReader / raw AtomicBuffer at
// externally-computed absolute offsets. A symmetric offset bug in the
// resolution logic would fail these cross-checks even if the writer/reader
// round-trip via the abstraction keeps passing.

#[test]
fn reader_struct_read_sees_value_written_via_tb_at_expected_offset() {
    const S: usize = 8;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<S, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let _s1 = store.insert().unwrap();
    let slot = store.insert().unwrap();
    assert_eq!(slot, 2);

    let expected_abs = (slot - 1) * S + 3; // tb_start_offset=0
    store.get(slot).core_write(3, 4242);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    // EntryStoreReader API resolves the offset...
    assert_eq!(reader.get(slot).core_read(3), 4242);
    // ...and the raw TripleBufferReader at the externally-computed absolute
    // offset sees the same value. If either side miscomputes the offset, these
    // two reads disagree.
    assert_eq!(tb_reader.read(expected_abs), 4242);
}

#[test]
fn reader_struct_reads_distinct_slots_at_distinct_tb_offsets() {
    const S: usize = 8;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let tb_reader = tb.to_reader();
    let store = EntryStoreWriter::<S, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    let s3 = store.insert().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    store.get(s1).core_write(0, 91);
    store.get(s2).core_write(0, 92);
    store.get(s3).core_write(0, 93);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();

    // Reader API resolves slot -> field-0 as (slot - 1) * S + 0.
    assert_eq!(reader.get(s1).core_read(0), 91);
    assert_eq!(reader.get(s2).core_read(0), 92);
    assert_eq!(reader.get(s3).core_read(0), 93);

    // Raw TripleBufferReader reads at the externally-computed absolute offsets.
    assert_eq!(tb_reader.read(0 * S), 91);
    assert_eq!(tb_reader.read(1 * S), 92);
    assert_eq!(tb_reader.read(2 * S), 93);
}

#[test]
fn reader_attr_read_sees_value_written_at_expected_mem_offset() {
    const A: usize = 16;
    const CAP: usize = 4;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<8, 0, A>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        CAP,
    );

    let _s1 = store.insert().unwrap();
    let slot = store.insert().unwrap();
    assert_eq!(slot, 2);

    store.get(slot).attr_write(5, 7777);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    let expected_abs = attr_base + (slot - 1) * A + 5;

    let reader = store.to_reader();
    // Reader API resolves slot -> field-5.
    assert_eq!(reader.get(slot).attr_read(5), 7777);
    // Raw mem at the externally-computed absolute offset must agree.
    assert_eq!(mem[expected_abs].load(Ordering::Relaxed), 7777);
}

#[test]
fn reader_attr_reads_distinct_slots_at_distinct_mem_offsets() {
    const A: usize = 16;
    const CAP: usize = 4;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<8, 0, A>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        CAP,
    );

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    let s3 = store.insert().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    store.get(s1).attr_write(0, 501);
    store.get(s2).attr_write(0, 502);
    store.get(s3).attr_write(0, 503);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    let reader = store.to_reader();

    assert_eq!(reader.get(s1).attr_read(0), 501);
    assert_eq!(reader.get(s2).attr_read(0), 502);
    assert_eq!(reader.get(s3).attr_read(0), 503);

    // Raw mem at externally-computed absolute offsets must agree slot-for-slot.
    assert_eq!(mem[attr_base + 0 * A].load(Ordering::Relaxed), 501);
    assert_eq!(mem[attr_base + 1 * A].load(Ordering::Relaxed), 502);
    assert_eq!(mem[attr_base + 2 * A].load(Ordering::Relaxed), 503);
}

#[test]
fn reader_layout_sizes_match_writer_layout() {
    const S: usize = 8;
    const A: usize = 16;
    const CAP: usize = 4;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<S, 0, A>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        CAP,
    );
    let reader = store.to_reader();

    // Mem plane span as predicted by the layout formula: allocator + attr plane.
    assert_eq!(
        reader.mem_end_offset() - reader.mem_start_offset(),
        SlotAllocator::calculate_size_on_mem(CAP) + CAP * A,
    );

    // TB plane span as predicted by the layout formula: capacity * STRUCT_STRIDE.
    assert_eq!(
        reader.tb_end_offset() - reader.tb_start_offset(),
        CAP * S,
    );
}

// ============ META_STRIDE > 0 ============
//
// Symmetric section to the writer's META_STRIDE > 0 block. Same layout
// invariant under test: per-slot TB layout is `[core | meta]` interleaved.
// For slot k (1-based):
//   struct_start = tb_start_offset + (k - 1) * (CORE_STRIDE + META_STRIDE)
//   core zone   = [struct_start, struct_start + CORE_STRIDE)
//   meta zone   = [struct_start + CORE_STRIDE, struct_start + CORE_STRIDE + META_STRIDE)

/// Local helper for the META_STRIDE > 0 section. The existing reader tests
/// construct stores inline; this helper keeps the new tests compact.
fn make_store_cma<const C: usize, const M: usize, const A: usize>(
    capacity: usize,
) -> (AtomicBuffer, TripleBufferWriter, EntryStoreWriter<C, M, A>) {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = EntryStoreWriter::<C, M, A>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        capacity,
    );
    (mem, tb, store)
}

// ---- Construction + size ----

#[test]
fn meta_reader_calculate_size_on_tb_is_capacity_times_core_plus_meta() {
    assert_eq!(EntryStoreReader::<4, 4, 16>::calculate_size_on_tb(4), 4 * (4 + 4));
    assert_eq!(EntryStoreReader::<8, 16, 16>::calculate_size_on_tb(4), 4 * (8 + 16));
    assert_eq!(EntryStoreReader::<1, 1, 1>::calculate_size_on_tb(1), 1 * (1 + 1));
    assert_eq!(EntryStoreReader::<16, 0, 8>::calculate_size_on_tb(256), 256 * (16 + 0));
    assert_eq!(EntryStoreReader::<64, 64, 16>::calculate_size_on_tb(32), 32 * (64 + 64));

    // Reader and writer formulas must agree across several combinations.
    for cap in [1usize, 4, 16, 32] {
        assert_eq!(
            EntryStoreReader::<4, 4, 16>::calculate_size_on_tb(cap),
            EntryStoreWriter::<4, 4, 16>::calculate_size_on_tb(cap),
        );
        assert_eq!(
            EntryStoreReader::<8, 16, 16>::calculate_size_on_tb(cap),
            EntryStoreWriter::<8, 16, 16>::calculate_size_on_tb(cap),
        );
    }
}

#[test]
fn meta_reader_calculate_size_on_mem_is_independent_of_core_and_meta() {
    let base = EntryStoreReader::<0, 0, 16>::calculate_size_on_mem(32);
    assert_eq!(EntryStoreReader::<8, 0, 16>::calculate_size_on_mem(32), base);
    assert_eq!(EntryStoreReader::<0, 8, 16>::calculate_size_on_mem(32), base);
    assert_eq!(EntryStoreReader::<8, 16, 16>::calculate_size_on_mem(32), base);
    assert_eq!(EntryStoreReader::<64, 64, 16>::calculate_size_on_mem(32), base);
}

// ---- Writer -> Reader roundtrip with META ----

#[test]
fn core_meta_writer_reader_roundtrip_after_publish_swap() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(4);
    let tb_reader = tb.to_reader();

    let s = store.insert().unwrap();
    let core: [i32; C] = [11, 22, 33, 44];
    let meta: [i32; M] = [-11, -22, -33, -44];
    store.get(s).core_write_all(core);
    store.get(s).meta_write_all(meta);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s).core_read_all(), core);
    assert_eq!(reader.get(s).meta_read_all(), meta);
    for i in 0..C {
        assert_eq!(reader.get(s).core_read(i), core[i]);
    }
    for j in 0..M {
        assert_eq!(reader.get(s).meta_read(j), meta[j]);
    }
}

#[test]
fn core_meta_roundtrip_with_1_1_edge_case() {
    let (_mem, tb, store) = make_store_cma::<1, 1, 1>(1);
    let tb_reader = tb.to_reader();

    let s = store.insert().unwrap();
    store.get(s).core_write(0, 7);
    store.get(s).meta_write(0, -9);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s).core_read(0), 7);
    assert_eq!(reader.get(s).meta_read(0), -9);
    assert_eq!(reader.get(s).core_read_all(), [7]);
    assert_eq!(reader.get(s).meta_read_all(), [-9]);
}

#[test]
fn core_meta_roundtrip_with_large_strides() {
    // CORE=64, META=64, capacity=4 => 4 * 128 = 512 <= TB_BUFFER_CAPACITY (1024).
    const C: usize = 64;
    const M: usize = 64;
    const CAP: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(CAP);
    let tb_reader = tb.to_reader();

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    assert_eq!((s1, s2), (1, 2));

    let mut c1 = [0i32; C];
    let mut m1 = [0i32; M];
    let mut c2 = [0i32; C];
    let mut m2 = [0i32; M];
    for i in 0..C {
        c1[i] = i as i32;
        c2[i] = -(i as i32) - 1;
    }
    for j in 0..M {
        m1[j] = (j as i32) + 1000;
        m2[j] = -(j as i32) - 2000;
    }
    store.get(s1).core_write_all(c1);
    store.get(s1).meta_write_all(m1);
    store.get(s2).core_write_all(c2);
    store.get(s2).meta_write_all(m2);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s1).core_read_all(), c1);
    assert_eq!(reader.get(s1).meta_read_all(), m1);
    assert_eq!(reader.get(s2).core_read_all(), c2);
    assert_eq!(reader.get(s2).meta_read_all(), m2);
}

// ---- Layout verification via raw TripleBufferReader ----

#[test]
fn reader_core_meta_sees_tb_at_expected_interleaved_offsets() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(4);
    let tb_reader = tb.to_reader();

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    let s3 = store.insert().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    store.get(s1).core_write_all([1, 2, 3, 4]);
    store.get(s1).meta_write_all([5, 6, 7, 8]);
    store.get(s2).core_write_all([9, 10, 11, 12]);
    store.get(s2).meta_write_all([13, 14, 15, 16]);
    store.get(s3).core_write_all([17, 18, 19, 20]);
    store.get(s3).meta_write_all([21, 22, 23, 24]);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();

    for (k, (core_exp, meta_exp)) in [
        ([1, 2, 3, 4], [5, 6, 7, 8]),
        ([9, 10, 11, 12], [13, 14, 15, 16]),
        ([17, 18, 19, 20], [21, 22, 23, 24]),
    ]
    .iter()
    .enumerate()
    {
        let slot = k + 1;
        assert_eq!(reader.get(slot).core_read_all(), *core_exp, "reader core slot {}", slot);
        assert_eq!(reader.get(slot).meta_read_all(), *meta_exp, "reader meta slot {}", slot);

        // Raw TripleBufferReader at externally-computed absolute offsets.
        let start = k * (C + M); // tb_start_offset = 0
        for i in 0..C {
            assert_eq!(tb_reader.read(start + i), core_exp[i], "tb core slot {} [{}]", slot, i);
        }
        for j in 0..M {
            assert_eq!(tb_reader.read(start + C + j), meta_exp[j], "tb meta slot {} [{}]", slot, j);
        }
    }
}

#[test]
fn reader_core_meta_distinct_slots_do_not_overlap() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(4);
    let tb_reader = tb.to_reader();

    let s1 = store.insert().unwrap();
    let s2 = store.insert().unwrap();
    assert_eq!((s1, s2), (1, 2));

    // Write only slot 1. Slot 2's core+meta zone must remain zero.
    store.get(s1).core_write_all([0xAA_AA_AA_AAu32 as i32; C]);
    store.get(s1).meta_write_all([0xBB_BB_BB_BBu32 as i32; M]);

    tb.publish();
    assert!(tb_reader.swap());

    let reader = store.to_reader();
    assert_eq!(reader.get(s1).core_read_all(), [0xAA_AA_AA_AAu32 as i32; C]);
    assert_eq!(reader.get(s1).meta_read_all(), [0xBB_BB_BB_BBu32 as i32; M]);
    assert_eq!(reader.get(s2).core_read_all(), [0; C]);
    assert_eq!(reader.get(s2).meta_read_all(), [0; M]);
}

// ---- Bounds panics for META on reader side ----

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "TbZoneReader.read | offset")]
fn reader_meta_read_at_stride_panics() {
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<4, M, 16>(4);
    let tb_reader = tb.to_reader();

    // Publish an active slot so the reader has something valid behind slot 1,
    // but the bounds check in TbZoneReader.read fires regardless.
    let _s = store.insert().unwrap();
    tb.publish();
    let _ = tb_reader.swap();

    let reader = store.to_reader();
    // One past the last valid meta offset.
    let _ = reader.get(1).meta_read(M);
}
