use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;
use synaptic_kernel::primitives::dual_store_writer::DualStoreWriter;
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

/// Default mem/tb offsets used in most tests. Pick an offset past the TB
/// region so allocator + attribute plane data never overlaps the buffers.
const TB_BUFFER_CAPACITY: usize = 1024;
const TB_MEM_RESERVED: usize = 4 + TB_BUFFER_CAPACITY * 3; // TripleBufferWriter::calculate_size_on_mem
const DEFAULT_MEM_START_OFFSET: usize = TB_MEM_RESERVED + 8;
const MEM_SIZE: usize = 16384;

fn make_tb(mem: &AtomicBuffer) -> TripleBufferWriter {
    TripleBufferWriter::new(Arc::clone(mem), 0, TB_BUFFER_CAPACITY)
}

fn make_store<const S: usize, const A: usize>(
    capacity: usize,
) -> (AtomicBuffer, TripleBufferWriter, DualStoreWriter<S, 0, A>) {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<S, 0, A>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        capacity,
    );
    (mem, tb, store)
}

// ============ Construction ============

#[test]
fn new_constructs_with_8_16_capacity_4() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    assert_eq!(store.capacity(), 4);
    assert_eq!(store.len(), 0);
}

#[test]
fn new_constructs_with_4_32_capacity_16() {
    let (_mem, _tb, store) = make_store::<4, 32>(16);
    assert_eq!(store.capacity(), 16);
    assert_eq!(store.len(), 0);
}

#[test]
fn new_constructs_with_1_1_capacity_1() {
    let (_mem, _tb, store) = make_store::<1, 1>(1);
    assert_eq!(store.capacity(), 1);
    assert_eq!(store.len(), 0);
}

#[test]
fn new_constructs_with_16_8_capacity_256() {
    let (_mem, _tb, store) = make_store::<16, 8>(256);
    assert_eq!(store.capacity(), 256);
    assert_eq!(store.len(), 0);
}

#[test]
fn calculate_size_on_mem_returns_sum() {
    // capacity 16, STRUCT_STRIDE=8, ATTR_STRIDE=16
    // mem plane holds SlotAllocator + AttributePlane => no STRUCT_STRIDE involvement
    let size_a = DualStoreWriter::<8, 0, 16>::calculate_size_on_mem(16);
    let size_b = DualStoreWriter::<8, 0, 16>::calculate_size_on_mem(32);
    // Doubling capacity strictly increases mem required.
    assert!(size_b > size_a);
    // Also sanity: size should include ATTR_STRIDE * capacity contribution.
    let diff = size_b - size_a;
    // Attribute plane contribution: (32 - 16) * 16 = 256 for ATTR_STRIDE=16.
    // Remainder comes from SlotAllocator growth.
    assert!(diff >= 16 * 16);
}

#[test]
fn calculate_size_on_tb_returns_capacity_times_stride() {
    assert_eq!(DualStoreWriter::<8, 0, 16>::calculate_size_on_tb(4), 32);
    assert_eq!(DualStoreWriter::<4, 0, 32>::calculate_size_on_tb(16), 64);
    assert_eq!(DualStoreWriter::<1, 0, 1>::calculate_size_on_tb(1), 1);
    assert_eq!(DualStoreWriter::<16, 0, 8>::calculate_size_on_tb(256), 256 * 16);
}

// ============ Allocation (1-based) ============

#[test]
fn insert_struct_returns_one_based_slots_in_order() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);

    let s1 = store.insert_struct().expect("slot 1 should allocate");
    let s2 = store.insert_struct().expect("slot 2 should allocate");
    let s3 = store.insert_struct().expect("slot 3 should allocate");
    let s4 = store.insert_struct().expect("slot 4 should allocate");

    // 1-based invariant: slot 0 is reserved as the null sentinel.
    assert_eq!(s1, 1);
    assert_eq!(s2, 2);
    assert_eq!(s3, 3);
    assert_eq!(s4, 4);

    for s in [s1, s2, s3, s4] {
        assert!(s > 0);
        assert!(s <= store.capacity());
        assert!(store.is_active_slot(s));
    }
}

#[test]
fn insert_struct_returns_none_when_capacity_full() {
    let (_mem, _tb, store) = make_store::<8, 16>(2);
    assert!(store.insert_struct().is_some());
    assert!(store.insert_struct().is_some());
    assert!(store.insert_struct().is_none());
    assert!(store.insert_struct().is_none());
}

#[test]
fn insert_struct_zeroes_struct_plane() {
    // Prime the TB region with garbage, then verify insert_struct zeroes it.
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    // Populate the whole TB capacity range with non-zero data on all 3 buffers.
    // We can't write the non-writer buffers directly via tb.write, so instead
    // just write the writer buffer, publish (sync refills next writer), write again, etc.
    for round in 0..3 {
        for i in 0..32 {
            tb.write(i, 777 + round);
        }
        tb.publish();
    }
    // After 3 publishes, all three underlying buffers hold non-zero data in [0..32).
    let store =
        DualStoreWriter::<8, 0, 16>::new(Arc::clone(&mem), tb.clone(), DEFAULT_MEM_START_OFFSET, 0, 4);
    let s = store.insert_struct().unwrap();
    for offset in 0..8 {
        assert_eq!(
            store.core_read(s, offset),
            0,
            "insert_struct must zero the struct plane at offset {}",
            offset
        );
    }
}

#[test]
fn insert_struct_clears_attribute_plane() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();
    // Manually poison attributes before testing clear-on-reinsert.
    for offset in 0..16 {
        store.attr_write(s, offset, 42 + offset as i32);
    }
    for offset in 0..16 {
        assert_ne!(store.attr_read(s, offset), 0);
    }
    // Remove, publish+ack+publish to reclaim, then reinsert -> must be cleared.
    let reader_ack = store.to_staging_buffer_reader();
    store.remove_struct(s).unwrap();
    store.publish();
    reader_ack.ack();
    store.publish();

    let s2 = store.insert_struct().unwrap();
    assert_eq!(s2, s);
    for offset in 0..16 {
        assert_eq!(
            store.attr_read(s2, offset),
            0,
            "insert_struct must clear attribute plane at offset {}",
            offset
        );
    }
}

// ============ Struct plane read/write ============

#[test]
fn struct_write_read_roundtrip() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.core_write(s, 0, 111);
    store.core_write(s, 3, 222);
    store.core_write(s, 7, 333);

    assert_eq!(store.core_read(s, 0), 111);
    assert_eq!(store.core_read(s, 3), 222);
    assert_eq!(store.core_read(s, 7), 333);
}

#[test]
fn struct_write_all_read_all_roundtrip() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    let data: [i32; 8] = [-1, 2, -3, 4, -5, 6, -7, 8];
    store.core_write_all(s, data);
    assert_eq!(store.core_read_all(s), data);
}

#[test]
fn struct_writes_are_isolated_per_slot() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();

    let d1: [i32; 8] = [1, 1, 1, 1, 1, 1, 1, 1];
    let d2: [i32; 8] = [2, 2, 2, 2, 2, 2, 2, 2];
    store.core_write_all(s1, d1);
    store.core_write_all(s2, d2);

    assert_eq!(store.core_read_all(s1), d1);
    assert_eq!(store.core_read_all(s2), d2);
}

// ============ Attribute plane read/write ============

#[test]
fn attr_write_read_roundtrip() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 100);
    store.attr_write(s, 5, 500);
    store.attr_write(s, 15, 1500);

    assert_eq!(store.attr_read(s, 0), 100);
    assert_eq!(store.attr_read(s, 5), 500);
    assert_eq!(store.attr_read(s, 15), 1500);
}

#[test]
fn attr_write_all_read_all_roundtrip() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    let mut data: [i32; 16] = [0; 16];
    for i in 0..16 {
        data[i] = (i as i32) * 7 - 3;
    }
    store.attr_write_all(s, data);
    assert_eq!(store.attr_read_all(s), data);
}

#[test]
fn attr_or_sets_bits_and_returns_previous_value() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b0011);
    let prev = store.attr_or(s, 0, 0b1100);
    assert_eq!(prev, 0b0011);
    assert_eq!(store.attr_read(s, 0), 0b1111);
}

#[test]
fn attr_and_masks_bits_and_returns_previous_value() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b1111);
    let prev = store.attr_and(s, 0, 0b0101);
    assert_eq!(prev, 0b1111);
    assert_eq!(store.attr_read(s, 0), 0b0101);
}

#[test]
fn attr_or_with_zero_mask_is_noop_but_returns_prior() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b1010);
    let prev = store.attr_or(s, 0, 0);
    assert_eq!(prev, 0b1010);
    assert_eq!(store.attr_read(s, 0), 0b1010);
}

#[test]
fn attr_and_with_all_bits_mask_is_noop_but_returns_prior() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b1010);
    let prev = store.attr_and(s, 0, !0i32);
    assert_eq!(prev, 0b1010);
    assert_eq!(store.attr_read(s, 0), 0b1010);
}

#[test]
fn attr_and_with_zero_mask_clears_all_bits_and_returns_prior() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b1111_0110);
    let prev = store.attr_and(s, 0, 0);
    assert_eq!(prev, 0b1111_0110);
    assert_eq!(store.attr_read(s, 0), 0);
}

#[test]
fn attr_or_is_idempotent_on_second_call() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0b0001);
    let first = store.attr_or(s, 0, 0b1100);
    let second = store.attr_or(s, 0, 0b1100);
    assert_eq!(first, 0b0001, "first call returns prior state");
    assert_eq!(second, 0b1101, "second call returns state already merged by first");
    assert_eq!(store.attr_read(s, 0), 0b1101);
}

#[test]
fn attr_or_and_chain_produces_expected_bitmask() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0);
    assert_eq!(store.attr_or(s, 0, 0b0011), 0);
    assert_eq!(store.attr_and(s, 0, 0b1010), 0b0011);
    assert_eq!(store.attr_read(s, 0), 0b0010);
    assert_eq!(store.attr_or(s, 0, 0b0100), 0b0010);
    assert_eq!(store.attr_read(s, 0), 0b0110);
}

#[test]
fn attr_or_at_distinct_offsets_within_slot_are_isolated() {
    const A: usize = 16;
    let (_mem, _tb, store) = make_store::<8, A>(4);
    let s = store.insert_struct().unwrap();

    for i in 0..A {
        store.attr_write(s, i, 0);
    }
    store.attr_or(s, 3, 0b1010);
    for i in 0..A {
        let expected = if i == 3 { 0b1010 } else { 0 };
        assert_eq!(store.attr_read(s, i), expected, "offset {} leaked", i);
    }
}

#[test]
fn attr_and_or_at_distinct_slots_are_isolated() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    let s3 = store.insert_struct().unwrap();

    store.attr_write(s1, 0, 0b1111);
    store.attr_write(s2, 0, 0b1111);
    store.attr_write(s3, 0, 0b1111);

    assert_eq!(store.attr_and(s2, 0, 0b0101), 0b1111);
    assert_eq!(store.attr_read(s1, 0), 0b1111, "s1 must not be affected");
    assert_eq!(store.attr_read(s2, 0), 0b0101);
    assert_eq!(store.attr_read(s3, 0), 0b1111, "s3 must not be affected");

    assert_eq!(store.attr_or(s3, 0, 0b0001_0000), 0b1111);
    assert_eq!(store.attr_read(s1, 0), 0b1111);
    assert_eq!(store.attr_read(s2, 0), 0b0101);
    assert_eq!(store.attr_read(s3, 0), 0b0001_1111);
}

#[test]
fn attr_or_sets_sign_bit_and_returns_unsigned_prior() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.attr_write(s, 0, 0x0000_0001);
    let prev = store.attr_or(s, 0, i32::MIN);
    assert_eq!(prev, 0x0000_0001);
    assert_eq!(store.attr_read(s, 0), i32::MIN | 0x0000_0001);
    assert!(store.attr_read(s, 0) < 0, "sign bit must be set");

    let prev2 = store.attr_and(s, 0, i32::MAX);
    assert_eq!(prev2, i32::MIN | 0x0000_0001);
    assert_eq!(store.attr_read(s, 0), 0x0000_0001);
    assert!(store.attr_read(s, 0) > 0);
}

// ============ Active / capacity / utilization ============

#[test]
fn is_active_slot_true_after_insert_false_after_remove() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();
    assert!(store.is_active_slot(s));

    store.remove_struct(s).unwrap();
    // remove_struct calls defer_free, which marks the slot inactive immediately
    // (even though the free list has not yet reclaimed it).
    assert!(!store.is_active_slot(s));
}

#[test]
fn capacity_len_utilization_track_insertions() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    assert_eq!(store.capacity(), 4);
    assert_eq!(store.len(), 0);
    assert_eq!(store.utilization(), 0.0);

    let s1 = store.insert_struct().unwrap();
    assert_eq!(store.len(), 1);
    assert!((store.utilization() - 0.25).abs() < f32::EPSILON);

    let _ = store.insert_struct().unwrap();
    assert_eq!(store.len(), 2);
    assert!((store.utilization() - 0.5).abs() < f32::EPSILON);

    store.remove_struct(s1).unwrap();
    // defer_free does not move alloc_count until publish drains to free list.
    assert_eq!(store.len(), 2);
}

// ============ Slot reuse clears both planes ============

#[test]
fn slot_reuse_zeroes_both_planes() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    store.core_write_all(s, [11, 22, 33, 44, 55, 66, 77, 88]);
    store.attr_write_all(s, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    let reader_ack = store.to_staging_buffer_reader();
    store.remove_struct(s).unwrap();
    store.publish();
    reader_ack.ack();
    store.publish();

    let s2 = store.insert_struct().unwrap();
    assert_eq!(s2, s, "SimpleFreeList LIFO should reuse the just-freed slot");
    assert_eq!(store.core_read_all(s2), [0; 8]);
    assert_eq!(store.attr_read_all(s2), [0; 16]);
}

// ============ Memory layout ============

#[test]
fn mem_offset_accessors_report_sizes() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let mem_start = DEFAULT_MEM_START_OFFSET;
    let tb_start = 0;
    let capacity = 8;
    let store = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        mem_start,
        tb_start,
        capacity,
    );

    assert_eq!(store.mem_start_offset(), mem_start);
    assert_eq!(
        store.mem_end_offset() - store.mem_start_offset(),
        DualStoreWriter::<8, 0, 16>::calculate_size_on_mem(capacity)
    );

    assert_eq!(store.tb_start_offset(), tb_start);
    assert_eq!(
        store.tb_end_offset() - store.tb_start_offset(),
        DualStoreWriter::<8, 0, 16>::calculate_size_on_tb(capacity)
    );
}

#[test]
fn construction_at_nonzero_offsets_works() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let mem_start = DEFAULT_MEM_START_OFFSET + 64;
    let tb_start = 32;
    let capacity = 4;
    let store = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        mem_start,
        tb_start,
        capacity,
    );

    assert_eq!(store.mem_start_offset(), mem_start);
    assert_eq!(store.tb_start_offset(), tb_start);

    let s = store.insert_struct().unwrap();
    store.core_write(s, 0, 42);
    store.attr_write(s, 0, 7);
    assert_eq!(store.core_read(s, 0), 42);
    assert_eq!(store.attr_read(s, 0), 7);
}

#[test]
fn mem_staging_buffer_start_offset_is_within_mem_region() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let sb_start = store.mem_staging_buffer_start_offset();
    assert!(sb_start >= store.mem_start_offset());
    assert!(sb_start < store.mem_end_offset());
}

// ============ new vs bind ============

#[test]
fn bind_recovers_state_from_preinitialized_mem() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let first = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = first.insert_struct().unwrap();
    let s2 = first.insert_struct().unwrap();
    first.core_write(s1, 0, 1001);
    first.core_write(s2, 0, 2002);
    first.attr_write(s1, 0, 9001);
    first.attr_write(s2, 0, 9002);

    // Re-attach via bind without re-initializing.
    let rebound = DualStoreWriter::<8, 0, 16>::bind(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );
    assert_eq!(rebound.capacity(), 4);
    assert_eq!(rebound.len(), 2);
    assert!(rebound.is_active_slot(s1));
    assert!(rebound.is_active_slot(s2));
    assert_eq!(rebound.core_read(s1, 0), 1001);
    assert_eq!(rebound.core_read(s2, 0), 2002);
    assert_eq!(rebound.attr_read(s1, 0), 9001);
    assert_eq!(rebound.attr_read(s2, 0), 9002);
}

// ============ to_reader / to_staging_buffer_reader ============

#[test]
fn to_reader_matches_offsets_and_capacity() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let reader = store.to_reader();
    assert_eq!(reader.capacity(), store.capacity());
    assert_eq!(reader.mem_start_offset(), store.mem_start_offset());
    assert_eq!(reader.mem_end_offset(), store.mem_end_offset());
    assert_eq!(reader.tb_start_offset(), store.tb_start_offset());
    assert_eq!(reader.tb_end_offset(), store.tb_end_offset());
}

#[test]
fn to_reader_roundtrip_with_publish_and_swap() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    // External TripleBufferReader for swap control — DualStoreReader has no swap().
    let tb_reader = tb.to_reader();
    let store = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    store.core_write_all(s, [1, 2, 3, 4, 5, 6, 7, 8]);
    store.attr_write_all(s, [10; 16]);

    // Attribute reads are instantly visible — no publish/swap needed.
    let reader = store.to_reader();
    assert_eq!(reader.attr_read_all(s), [10; 16]);

    // Struct reads require TB publish + reader swap.
    tb.publish();
    assert!(tb_reader.swap());
    assert_eq!(reader.core_read_all(s), [1, 2, 3, 4, 5, 6, 7, 8]);
}

// ============ copy_from ============

#[test]
fn copy_from_migrates_allocator_attrs_and_struct_data() {
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = make_tb(&src_mem);
    let src = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&src_mem),
        src_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = src.insert_struct().unwrap();
    let s2 = src.insert_struct().unwrap();
    src.core_write_all(s1, [1, 2, 3, 4, 5, 6, 7, 8]);
    src.core_write_all(s2, [9, 10, 11, 12, 13, 14, 15, 16]);
    src.attr_write_all(s1, [100; 16]);
    src.attr_write_all(s2, [200; 16]);

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = make_tb(&dst_mem);
    let dst = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        8,
    );

    dst.copy_from(&src);

    // Allocator state migrated.
    assert!(dst.is_active_slot(s1));
    assert!(dst.is_active_slot(s2));
    assert_eq!(dst.len(), 2);

    // Attribute data migrated (mem plane, no publish required).
    assert_eq!(dst.attr_read_all(s1), [100; 16]);
    assert_eq!(dst.attr_read_all(s2), [200; 16]);

    // Struct data migrated. copy_region_from copies into all 3 TB buffers,
    // so writer-side reads see it immediately.
    assert_eq!(dst.core_read_all(s1), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert_eq!(dst.core_read_all(s2), [9, 10, 11, 12, 13, 14, 15, 16]);
}

// ============ publish ============

#[test]
fn writer_publish_enables_reclaim_after_ack() {
    // publish() only advances staging-buffer generation; reclaim requires
    // ack from a StagingBufferReader plus a second publish.
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let reader_ack = store.to_staging_buffer_reader();

    let s = store.insert_struct().unwrap();
    assert_eq!(store.len(), 1);

    store.remove_struct(s).unwrap();
    // Before the full reclaim cycle, len() still counts it.
    assert_eq!(store.len(), 1);

    store.publish();
    // Still pending — writer advanced generation but reader hasn't acked.
    assert_eq!(store.len(), 1);

    reader_ack.ack();
    // Reader has acknowledged, but writer hasn't drained yet.
    assert_eq!(store.len(), 1);

    store.publish();
    // Now drain picked up acked entries and returned them to the free list.
    assert_eq!(store.len(), 0);
}

// ============ get_struct handle ============

#[test]
fn get_struct_returns_writer_handle_for_repeated_access() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    let handle = store.get_struct(s);
    handle.core_write(0, 77);
    handle.core_write(7, 88);
    assert_eq!(handle.core_read(0), 77);
    assert_eq!(handle.core_read(7), 88);
    // Reads via the top-level API agree.
    assert_eq!(store.core_read(s, 0), 77);
    assert_eq!(store.core_read(s, 7), 88);
}

// ============ Debug-assertion panics ============

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "DualStore.get_struct | attempted to read inactive slot")]
fn get_struct_panics_on_inactive_slot() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    // slot 1 is in the valid 1-based range but has never been allocated.
    let _ = store.get_struct(1);
}

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "AttributePlaneWriter::new | range")]
fn insufficient_mem_panics_at_construction() {
    // capacity=16, ATTR_STRIDE=16 => attributes plane needs 256 words.
    // SlotAllocator requires ~57 words for capacity=16.
    // mem=128 fits the allocator but overflows when AttributePlaneWriter is built.
    let mem = create_mem(128);
    let tb_mem = create_mem(MEM_SIZE);
    let tb = make_tb(&tb_mem);
    let _store = DualStoreWriter::<8, 0, 16>::new(Arc::clone(&mem), tb, 0, 0, 16);
}

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "cannot be greater than destination.capacity")]
fn copy_from_panics_when_source_capacity_exceeds_destination() {
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = TripleBufferWriter::new(Arc::clone(&src_mem), 0, 1024);
    let src = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&src_mem),
        src_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        8,
    );

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), 0, 1024);
    let dst = DualStoreWriter::<8, 0, 16>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    dst.copy_from(&src);
}

// ============ Cross-layer layout verification ============
//
// These tests bypass the DualStore abstraction on one end of the round-trip:
// the expected absolute memory location is computed externally from the
// documented layout formulas, then cross-verified against either the raw
// `AtomicBuffer` (for the attribute plane) or the raw `TripleBufferWriter`
// (for the struct plane). The goal is to catch symmetric offset bugs in
// `calculate_struct_start_offset` / `resolve_mem_offset` that a pure
// round-trip test through the abstraction could not detect.

#[test]
fn struct_write_lands_at_expected_tb_offset_slot_1() {
    const S: usize = 8;
    let (_mem, tb, store) = make_store::<S, 16>(4);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    store.core_write(slot, 0, 111);
    store.core_write(slot, 3, 222);
    store.core_write(slot, 7, 333);

    // tb_start_offset=0, slot=1 => base offset is 0*S = 0.
    assert_eq!(tb.read(0 * S + 0), 111);
    assert_eq!(tb.read(0 * S + 3), 222);
    assert_eq!(tb.read(0 * S + 7), 333);
}

#[test]
fn struct_write_lands_at_expected_tb_offset_slot_3() {
    const S: usize = 8;
    let (_mem, tb, store) = make_store::<S, 16>(4);
    let _ = store.insert_struct().unwrap();
    let _ = store.insert_struct().unwrap();
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 3);

    store.core_write(slot, 0, 444);
    store.core_write(slot, 3, 555);
    store.core_write(slot, 7, 666);

    // tb_start_offset=0, slot=3 => base offset is 2*S = 16.
    assert_eq!(tb.read(2 * S + 0), 444);
    assert_eq!(tb.read(2 * S + 3), 555);
    assert_eq!(tb.read(2 * S + 7), 666);
}

#[test]
fn struct_write_respects_nonzero_tb_start_offset() {
    const S: usize = 8;
    const TB_START: usize = 32;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<S, 0, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        TB_START,
        4,
    );
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    store.core_write(slot, 0, 1001);
    store.core_write(slot, 7, 1007);

    // tb_start_offset=32, slot=1 => base absolute offset is 32 + 0*S.
    assert_eq!(tb.read(TB_START + 0 * S + 0), 1001);
    assert_eq!(tb.read(TB_START + 0 * S + 7), 1007);
}

#[test]
fn struct_read_sees_value_written_via_tb_directly() {
    const S: usize = 8;
    let (_mem, tb, store) = make_store::<S, 16>(4);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    // Write directly through TripleBufferWriter at the externally-computed
    // absolute offset, and verify DualStoreWriter.struct_read sees it.
    let abs0 = 0 * S + 0;
    let abs3 = 0 * S + 3;
    let abs7 = 0 * S + 7;
    tb.write(abs0, 7001);
    tb.write(abs3, 7003);
    tb.write(abs7, 7007);

    assert_eq!(store.core_read(slot, 0), 7001);
    assert_eq!(store.core_read(slot, 3), 7003);
    assert_eq!(store.core_read(slot, 7), 7007);
}

#[test]
fn struct_writes_to_different_slots_occupy_distinct_tb_regions() {
    const S: usize = 8;
    let (_mem, tb, store) = make_store::<S, 16>(4);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    let s3 = store.insert_struct().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    store.core_write(s1, 0, 10_001);
    store.core_write(s2, 0, 20_002);
    store.core_write(s3, 0, 30_003);

    // (slot - 1) * STRIDE for each slot's 0th field, tb_start_offset=0.
    assert_eq!(tb.read(0 * S), 10_001);
    assert_eq!(tb.read(1 * S), 20_002);
    assert_eq!(tb.read(2 * S), 30_003);

    // Slot regions must not overlap: each slot's value appears only at its own base.
    assert_ne!(tb.read(0 * S), 20_002);
    assert_ne!(tb.read(0 * S), 30_003);
    assert_ne!(tb.read(1 * S), 10_001);
    assert_ne!(tb.read(1 * S), 30_003);
    assert_ne!(tb.read(2 * S), 10_001);
    assert_ne!(tb.read(2 * S), 20_002);
}

#[test]
fn attr_write_lands_at_expected_mem_offset_slot_1() {
    const A: usize = 16;
    const CAP: usize = 4;
    let (mem, _tb, store) = make_store::<8, A>(CAP);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    store.attr_write(slot, 0, 999);
    store.attr_write(slot, 7, 888);
    store.attr_write(slot, 15, 777);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    assert_eq!(mem[attr_base + 0 * A + 0].load(Ordering::Relaxed), 999);
    assert_eq!(mem[attr_base + 0 * A + 7].load(Ordering::Relaxed), 888);
    assert_eq!(mem[attr_base + 0 * A + 15].load(Ordering::Relaxed), 777);
}

#[test]
fn attr_write_lands_at_expected_mem_offset_slot_3() {
    const A: usize = 16;
    const CAP: usize = 4;
    let (mem, _tb, store) = make_store::<8, A>(CAP);
    let _ = store.insert_struct().unwrap();
    let _ = store.insert_struct().unwrap();
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 3);

    store.attr_write(slot, 0, 3000);
    store.attr_write(slot, 5, 3005);
    store.attr_write(slot, 15, 3015);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    assert_eq!(mem[attr_base + 2 * A + 0].load(Ordering::Relaxed), 3000);
    assert_eq!(mem[attr_base + 2 * A + 5].load(Ordering::Relaxed), 3005);
    assert_eq!(mem[attr_base + 2 * A + 15].load(Ordering::Relaxed), 3015);
}

#[test]
fn attr_write_respects_nonzero_mem_start_offset() {
    const A: usize = 16;
    const CAP: usize = 4;
    const MEM_START: usize = DEFAULT_MEM_START_OFFSET + 128;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store =
        DualStoreWriter::<8, 0, A>::new(Arc::clone(&mem), tb.clone(), MEM_START, 0, CAP);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    store.attr_write(slot, 0, 42);
    store.attr_write(slot, 15, 43);

    let attr_base = MEM_START + SlotAllocator::calculate_size_on_mem(CAP);
    assert_eq!(mem[attr_base + 0 * A + 0].load(Ordering::Relaxed), 42);
    assert_eq!(mem[attr_base + 0 * A + 15].load(Ordering::Relaxed), 43);
}

#[test]
fn attr_read_sees_value_written_via_raw_mem() {
    const A: usize = 16;
    const CAP: usize = 4;
    let (mem, _tb, store) = make_store::<8, A>(CAP);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    // Write directly into the raw AtomicBuffer at externally-computed offsets,
    // bypassing DualStoreWriter.attr_write entirely.
    mem[attr_base + 0 * A + 0].store(5001, Ordering::Relaxed);
    mem[attr_base + 0 * A + 7].store(5007, Ordering::Relaxed);
    mem[attr_base + 0 * A + 15].store(5015, Ordering::Relaxed);

    assert_eq!(store.attr_read(slot, 0), 5001);
    assert_eq!(store.attr_read(slot, 7), 5007);
    assert_eq!(store.attr_read(slot, 15), 5015);
}

#[test]
fn attr_writes_to_different_slots_occupy_distinct_mem_regions() {
    const A: usize = 16;
    const CAP: usize = 4;
    let (mem, _tb, store) = make_store::<8, A>(CAP);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    let s3 = store.insert_struct().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    store.attr_write(s1, 0, 11_111);
    store.attr_write(s2, 0, 22_222);
    store.attr_write(s3, 0, 33_333);

    let attr_base = DEFAULT_MEM_START_OFFSET + SlotAllocator::calculate_size_on_mem(CAP);
    assert_eq!(mem[attr_base + 0 * A].load(Ordering::Relaxed), 11_111);
    assert_eq!(mem[attr_base + 1 * A].load(Ordering::Relaxed), 22_222);
    assert_eq!(mem[attr_base + 2 * A].load(Ordering::Relaxed), 33_333);

    // Distinct slot regions must not alias.
    assert_ne!(mem[attr_base + 0 * A].load(Ordering::Relaxed), 22_222);
    assert_ne!(mem[attr_base + 0 * A].load(Ordering::Relaxed), 33_333);
    assert_ne!(mem[attr_base + 1 * A].load(Ordering::Relaxed), 11_111);
    assert_ne!(mem[attr_base + 1 * A].load(Ordering::Relaxed), 33_333);
    assert_ne!(mem[attr_base + 2 * A].load(Ordering::Relaxed), 11_111);
    assert_ne!(mem[attr_base + 2 * A].load(Ordering::Relaxed), 22_222);
}

#[test]
fn mem_layout_matches_declared_sizes() {
    const S: usize = 8;
    const A: usize = 16;
    const CAP: usize = 4;
    let (_mem, _tb, store) = make_store::<S, A>(CAP);

    // mem_start_offset matches what we passed at construction.
    assert_eq!(store.mem_start_offset(), DEFAULT_MEM_START_OFFSET);

    // Mem plane must be exactly: SlotAllocator size + ATTR_STRIDE * capacity.
    assert_eq!(
        store.mem_end_offset() - store.mem_start_offset(),
        SlotAllocator::calculate_size_on_mem(CAP) + CAP * A,
    );

    // TB plane must be exactly: STRUCT_STRIDE * capacity.
    assert_eq!(
        store.tb_end_offset() - store.tb_start_offset(),
        CAP * S,
    );
}

// ============ META_STRIDE > 0 ============
//
// New section exercising the dual-zone (core + meta) layout. The layout
// invariant under test: per-slot TB layout is `[core | meta]` interleaved
// per slot, not plane-separated. For slot k (1-based):
//   struct_start = tb_start_offset + (k - 1) * (CORE_STRIDE + META_STRIDE)
//   core zone   = [struct_start, struct_start + CORE_STRIDE)
//   meta zone   = [struct_start + CORE_STRIDE, struct_start + CORE_STRIDE + META_STRIDE)

/// New generic helper for the META_STRIDE > 0 section. The existing
/// `make_store<S, A>` is signature-locked to `<S, 0, A>` and is used by
/// the entire pre-existing suite — do not change it.
fn make_store_cma<const C: usize, const M: usize, const A: usize>(
    capacity: usize,
) -> (AtomicBuffer, TripleBufferWriter, DualStoreWriter<C, M, A>) {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<C, M, A>::new(
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
fn meta_calculate_size_on_tb_is_capacity_times_core_plus_meta() {
    // Derived directly from the layout invariant: capacity * (CORE + META).
    assert_eq!(DualStoreWriter::<4, 4, 16>::calculate_size_on_tb(4), 4 * (4 + 4));
    assert_eq!(DualStoreWriter::<8, 16, 16>::calculate_size_on_tb(4), 4 * (8 + 16));
    assert_eq!(DualStoreWriter::<1, 1, 1>::calculate_size_on_tb(1), 1 * (1 + 1));
    // META=0 edge case must still match the formula.
    assert_eq!(DualStoreWriter::<16, 0, 8>::calculate_size_on_tb(256), 256 * (16 + 0));
    // Large pair.
    assert_eq!(DualStoreWriter::<64, 64, 16>::calculate_size_on_tb(32), 32 * (64 + 64));
}

#[test]
fn meta_calculate_size_on_mem_is_independent_of_core_and_meta() {
    // Mem plane holds only SlotAllocator + AttributePlane; CORE/META live
    // on the TB plane. Vary CORE/META while fixing ATTR+capacity: sizes
    // must match exactly.
    let base = DualStoreWriter::<0, 0, 16>::calculate_size_on_mem(32);
    assert_eq!(DualStoreWriter::<8, 0, 16>::calculate_size_on_mem(32), base);
    assert_eq!(DualStoreWriter::<0, 8, 16>::calculate_size_on_mem(32), base);
    assert_eq!(DualStoreWriter::<8, 16, 16>::calculate_size_on_mem(32), base);
    assert_eq!(DualStoreWriter::<64, 64, 16>::calculate_size_on_mem(32), base);

    // Doubling capacity grows by at least ATTR_STRIDE * (new - old).
    let grown = DualStoreWriter::<8, 16, 16>::calculate_size_on_mem(64);
    assert!(grown - base >= 32 * 16);
}

// ---- Core/meta isolation per slot ----

#[test]
fn core_meta_write_all_read_all_roundtrip_within_slot() {
    let (_mem, _tb, store) = make_store_cma::<4, 4, 16>(4);
    let s = store.insert_struct().unwrap();

    let core: [i32; 4] = [11, 22, 33, 44];
    let meta: [i32; 4] = [-11, -22, -33, -44];
    store.core_write_all(s, core);
    store.meta_write_all(s, meta);

    assert_eq!(store.core_read_all(s), core);
    assert_eq!(store.meta_read_all(s), meta);
}

#[test]
fn core_meta_per_field_writes_and_reads_are_distinct() {
    const C: usize = 8;
    const M: usize = 16;
    let (_mem, _tb, store) = make_store_cma::<C, M, 16>(4);
    let s = store.insert_struct().unwrap();

    // Distinct value spaces for core and meta so an accidental alias
    // would land a "wrong" value at a field.
    for i in 0..C {
        store.core_write(s, i, 1000 + i as i32);
    }
    for j in 0..M {
        store.meta_write(s, j, 2000 + j as i32);
    }

    for i in 0..C {
        assert_eq!(store.core_read(s, i), 1000 + i as i32, "core[{}]", i);
    }
    for j in 0..M {
        assert_eq!(store.meta_read(s, j), 2000 + j as i32, "meta[{}]", j);
    }
}

#[test]
fn core_meta_no_cross_contamination_on_mutation() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, _tb, store) = make_store_cma::<C, M, 16>(4);
    let s = store.insert_struct().unwrap();

    let core_initial: [i32; C] = [1, 2, 3, 4];
    let meta_initial: [i32; M] = [10, 20, 30, 40];
    store.core_write_all(s, core_initial);
    store.meta_write_all(s, meta_initial);

    // Mutating every core field must not perturb any meta field.
    for i in 0..C {
        store.core_write(s, i, -(i as i32) - 100);
    }
    assert_eq!(store.meta_read_all(s), meta_initial);

    // Mutating every meta field must not perturb any core field.
    let core_after_first_mutation = store.core_read_all(s);
    for j in 0..M {
        store.meta_write(s, j, -(j as i32) - 500);
    }
    assert_eq!(store.core_read_all(s), core_after_first_mutation);
}

// ---- Cross-slot isolation with META ----

#[test]
fn core_meta_cross_slot_isolation() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, _tb, store) = make_store_cma::<C, M, 16>(4);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    let s3 = store.insert_struct().unwrap();
    assert_eq!((s1, s2, s3), (1, 2, 3));

    let c1: [i32; C] = [1, 1, 1, 1];
    let c2: [i32; C] = [2, 2, 2, 2];
    let c3: [i32; C] = [3, 3, 3, 3];
    let m1: [i32; M] = [101, 101, 101, 101];
    let m2: [i32; M] = [202, 202, 202, 202];
    let m3: [i32; M] = [303, 303, 303, 303];
    store.core_write_all(s1, c1);
    store.core_write_all(s2, c2);
    store.core_write_all(s3, c3);
    store.meta_write_all(s1, m1);
    store.meta_write_all(s2, m2);
    store.meta_write_all(s3, m3);

    assert_eq!(store.core_read_all(s1), c1);
    assert_eq!(store.core_read_all(s2), c2);
    assert_eq!(store.core_read_all(s3), c3);
    assert_eq!(store.meta_read_all(s1), m1);
    assert_eq!(store.meta_read_all(s2), m2);
    assert_eq!(store.meta_read_all(s3), m3);
}

#[test]
fn core_meta_slot_reuse_zeroes_full_core_plus_meta_zone() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, _tb, store) = make_store_cma::<C, M, 16>(4);

    let s = store.insert_struct().unwrap();
    // Poison the entire core+meta zone of slot s.
    store.core_write_all(s, [0x11_11_11_11u32 as i32; C]);
    store.meta_write_all(s, [0x22_22_22_22u32 as i32; M]);

    let reader_ack = store.to_staging_buffer_reader();
    store.remove_struct(s).unwrap();
    store.publish();
    reader_ack.ack();
    store.publish();

    let s2 = store.insert_struct().unwrap();
    assert_eq!(s2, s, "SimpleFreeList LIFO should reuse the just-freed slot");

    // insert_struct loops 0..(CORE_STRIDE + META_STRIDE), so BOTH zones
    // must be zero on reuse.
    assert_eq!(store.core_read_all(s2), [0; C]);
    assert_eq!(store.meta_read_all(s2), [0; M]);
}

// ---- Layout verification via underlying TB ----

#[test]
fn core_meta_lands_at_expected_interleaved_tb_offsets_slot_1() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(4);
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 1);

    // Per layout invariant, start = tb_start_offset + (slot - 1) * (C + M) = 0.
    let start = 0usize;

    store.core_write_all(slot, [0xA1, 0xA2, 0xA3, 0xA4]);
    store.meta_write_all(slot, [0xB1, 0xB2, 0xB3, 0xB4]);

    // Core zone: [start, start + C)
    for i in 0..C {
        assert_eq!(tb.read(start + i), 0xA1 + i as i32, "core[{}]", i);
    }
    // Meta zone: [start + C, start + C + M)
    for j in 0..M {
        assert_eq!(tb.read(start + C + j), 0xB1 + j as i32, "meta[{}]", j);
    }
}

#[test]
fn core_meta_lands_at_expected_interleaved_tb_offsets_slot_3() {
    const C: usize = 4;
    const M: usize = 4;
    let (_mem, tb, store) = make_store_cma::<C, M, 16>(4);
    let _ = store.insert_struct().unwrap();
    let _ = store.insert_struct().unwrap();
    let slot = store.insert_struct().unwrap();
    assert_eq!(slot, 3);

    // start = 0 + (3 - 1) * (4 + 4) = 16.
    let start: usize = (slot - 1) * (C + M);

    store.core_write(slot, 0, 7_001);
    store.core_write(slot, 3, 7_003);
    store.meta_write(slot, 0, 8_001);
    store.meta_write(slot, 3, 8_003);

    assert_eq!(tb.read(start + 0), 7_001);
    assert_eq!(tb.read(start + 3), 7_003);
    assert_eq!(tb.read(start + C + 0), 8_001);
    assert_eq!(tb.read(start + C + 3), 8_003);
}

#[test]
fn core_meta_respects_nonzero_tb_start_offset() {
    const C: usize = 4;
    const M: usize = 4;
    const TB_START: usize = 32;
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<C, M, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        TB_START,
        4,
    );

    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();
    assert_eq!((s1, s2), (1, 2));

    store.core_write_all(s1, [1, 2, 3, 4]);
    store.meta_write_all(s1, [5, 6, 7, 8]);
    store.core_write_all(s2, [9, 10, 11, 12]);
    store.meta_write_all(s2, [13, 14, 15, 16]);

    let start1 = TB_START + 0 * (C + M);
    let start2 = TB_START + 1 * (C + M);
    for i in 0..C {
        assert_eq!(tb.read(start1 + i), (1 + i) as i32);
        assert_eq!(tb.read(start2 + i), (9 + i) as i32);
    }
    for j in 0..M {
        assert_eq!(tb.read(start1 + C + j), (5 + j) as i32);
        assert_eq!(tb.read(start2 + C + j), (13 + j) as i32);
    }

    // Slots are contiguous with no gap and no overlap:
    // start2 begins exactly where slot 1 ends.
    assert_eq!(start1 + C + M, start2);
}

// ---- Bounds panics for META ----

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "TbZoneWriter.write | offset")]
fn meta_write_at_stride_panics() {
    const M: usize = 4;
    let (_mem, _tb, store) = make_store_cma::<4, M, 16>(4);
    let s = store.insert_struct().unwrap();
    // One past the last valid meta offset.
    store.meta_write(s, M, 0);
}

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "TbZoneWriter.read | offset")]
fn meta_read_at_stride_panics() {
    const M: usize = 4;
    let (_mem, _tb, store) = make_store_cma::<4, M, 16>(4);
    let s = store.insert_struct().unwrap();
    let _ = store.meta_read(s, M);
}

// ---- copy_from with META ----

#[test]
fn copy_from_migrates_core_meta_and_attrs() {
    const C: usize = 4;
    const M: usize = 4;
    const A: usize = 16;
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = make_tb(&src_mem);
    let src = DualStoreWriter::<C, M, A>::new(
        Arc::clone(&src_mem),
        src_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = src.insert_struct().unwrap();
    let s2 = src.insert_struct().unwrap();
    let s3 = src.insert_struct().unwrap();

    let c1: [i32; C] = [1, 2, 3, 4];
    let c2: [i32; C] = [5, 6, 7, 8];
    let c3: [i32; C] = [9, 10, 11, 12];
    let m1: [i32; M] = [-1, -2, -3, -4];
    let m2: [i32; M] = [-5, -6, -7, -8];
    let m3: [i32; M] = [-9, -10, -11, -12];
    let a1: [i32; A] = [100; A];
    let a2: [i32; A] = [200; A];
    let a3: [i32; A] = [300; A];
    src.core_write_all(s1, c1);
    src.core_write_all(s2, c2);
    src.core_write_all(s3, c3);
    src.meta_write_all(s1, m1);
    src.meta_write_all(s2, m2);
    src.meta_write_all(s3, m3);
    src.attr_write_all(s1, a1);
    src.attr_write_all(s2, a2);
    src.attr_write_all(s3, a3);

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = make_tb(&dst_mem);
    let dst = DualStoreWriter::<C, M, A>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );
    dst.copy_from(&src);

    for (s, c, m, a) in [
        (s1, c1, m1, a1),
        (s2, c2, m2, a2),
        (s3, c3, m3, a3),
    ] {
        assert!(dst.is_active_slot(s));
        assert_eq!(dst.core_read_all(s), c, "core slot {}", s);
        assert_eq!(dst.meta_read_all(s), m, "meta slot {}", s);
        assert_eq!(dst.attr_read_all(s), a, "attr slot {}", s);
    }
}
