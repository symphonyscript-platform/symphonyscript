use std::sync::atomic::AtomicI32;
use std::sync::Arc;
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
) -> (AtomicBuffer, TripleBufferWriter, DualStoreWriter<S, A>) {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let store = DualStoreWriter::<S, A>::new(
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
    let size_a = DualStoreWriter::<8, 16>::calculate_size_on_mem(16);
    let size_b = DualStoreWriter::<8, 16>::calculate_size_on_mem(32);
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
    assert_eq!(DualStoreWriter::<8, 16>::calculate_size_on_tb(4), 32);
    assert_eq!(DualStoreWriter::<4, 32>::calculate_size_on_tb(16), 64);
    assert_eq!(DualStoreWriter::<1, 1>::calculate_size_on_tb(1), 1);
    assert_eq!(DualStoreWriter::<16, 8>::calculate_size_on_tb(256), 256 * 16);
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
        DualStoreWriter::<8, 16>::new(Arc::clone(&mem), tb.clone(), DEFAULT_MEM_START_OFFSET, 0, 4);
    let s = store.insert_struct().unwrap();
    for offset in 0..8 {
        assert_eq!(
            store.struct_read(s, offset),
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

    store.struct_write(s, 0, 111);
    store.struct_write(s, 3, 222);
    store.struct_write(s, 7, 333);

    assert_eq!(store.struct_read(s, 0), 111);
    assert_eq!(store.struct_read(s, 3), 222);
    assert_eq!(store.struct_read(s, 7), 333);
}

#[test]
fn struct_write_all_read_all_roundtrip() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s = store.insert_struct().unwrap();

    let data: [i32; 8] = [-1, 2, -3, 4, -5, 6, -7, 8];
    store.struct_write_all(s, data);
    assert_eq!(store.struct_read_all(s), data);
}

#[test]
fn struct_writes_are_isolated_per_slot() {
    let (_mem, _tb, store) = make_store::<8, 16>(4);
    let s1 = store.insert_struct().unwrap();
    let s2 = store.insert_struct().unwrap();

    let d1: [i32; 8] = [1, 1, 1, 1, 1, 1, 1, 1];
    let d2: [i32; 8] = [2, 2, 2, 2, 2, 2, 2, 2];
    store.struct_write_all(s1, d1);
    store.struct_write_all(s2, d2);

    assert_eq!(store.struct_read_all(s1), d1);
    assert_eq!(store.struct_read_all(s2), d2);
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

    store.struct_write_all(s, [11, 22, 33, 44, 55, 66, 77, 88]);
    store.attr_write_all(s, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    let reader_ack = store.to_staging_buffer_reader();
    store.remove_struct(s).unwrap();
    store.publish();
    reader_ack.ack();
    store.publish();

    let s2 = store.insert_struct().unwrap();
    assert_eq!(s2, s, "SimpleFreeList LIFO should reuse the just-freed slot");
    assert_eq!(store.struct_read_all(s2), [0; 8]);
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
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        mem_start,
        tb_start,
        capacity,
    );

    assert_eq!(store.mem_start_offset(), mem_start);
    assert_eq!(
        store.mem_end_offset() - store.mem_start_offset(),
        DualStoreWriter::<8, 16>::calculate_size_on_mem(capacity)
    );

    assert_eq!(store.tb_start_offset(), tb_start);
    assert_eq!(
        store.tb_end_offset() - store.tb_start_offset(),
        DualStoreWriter::<8, 16>::calculate_size_on_tb(capacity)
    );
}

#[test]
fn construction_at_nonzero_offsets_works() {
    let mem = create_mem(MEM_SIZE);
    let tb = make_tb(&mem);
    let mem_start = DEFAULT_MEM_START_OFFSET + 64;
    let tb_start = 32;
    let capacity = 4;
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        mem_start,
        tb_start,
        capacity,
    );

    assert_eq!(store.mem_start_offset(), mem_start);
    assert_eq!(store.tb_start_offset(), tb_start);

    let s = store.insert_struct().unwrap();
    store.struct_write(s, 0, 42);
    store.attr_write(s, 0, 7);
    assert_eq!(store.struct_read(s, 0), 42);
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
    let first = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = first.insert_struct().unwrap();
    let s2 = first.insert_struct().unwrap();
    first.struct_write(s1, 0, 1001);
    first.struct_write(s2, 0, 2002);
    first.attr_write(s1, 0, 9001);
    first.attr_write(s2, 0, 9002);

    // Re-attach via bind without re-initializing.
    let rebound = DualStoreWriter::<8, 16>::bind(
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
    assert_eq!(rebound.struct_read(s1, 0), 1001);
    assert_eq!(rebound.struct_read(s2, 0), 2002);
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
    let store = DualStoreWriter::<8, 16>::new(
        Arc::clone(&mem),
        tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s = store.insert_struct().unwrap();
    store.struct_write_all(s, [1, 2, 3, 4, 5, 6, 7, 8]);
    store.attr_write_all(s, [10; 16]);

    // Attribute reads are instantly visible — no publish/swap needed.
    let reader = store.to_reader();
    assert_eq!(reader.attr_read_all(s), [10; 16]);

    // Struct reads require TB publish + reader swap.
    tb.publish();
    assert!(tb_reader.swap());
    assert_eq!(reader.struct_read_all(s), [1, 2, 3, 4, 5, 6, 7, 8]);
}

// ============ copy_from ============

#[test]
fn copy_from_migrates_allocator_attrs_and_struct_data() {
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = make_tb(&src_mem);
    let src = DualStoreWriter::<8, 16>::new(
        Arc::clone(&src_mem),
        src_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    let s1 = src.insert_struct().unwrap();
    let s2 = src.insert_struct().unwrap();
    src.struct_write_all(s1, [1, 2, 3, 4, 5, 6, 7, 8]);
    src.struct_write_all(s2, [9, 10, 11, 12, 13, 14, 15, 16]);
    src.attr_write_all(s1, [100; 16]);
    src.attr_write_all(s2, [200; 16]);

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = make_tb(&dst_mem);
    let dst = DualStoreWriter::<8, 16>::new(
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
    assert_eq!(dst.struct_read_all(s1), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert_eq!(dst.struct_read_all(s2), [9, 10, 11, 12, 13, 14, 15, 16]);
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
    handle.write(0, 77);
    handle.write(7, 88);
    assert_eq!(handle.read(0), 77);
    assert_eq!(handle.read(7), 88);
    // Reads via the top-level API agree.
    assert_eq!(store.struct_read(s, 0), 77);
    assert_eq!(store.struct_read(s, 7), 88);
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
    let _store = DualStoreWriter::<8, 16>::new(Arc::clone(&mem), tb, 0, 0, 16);
}

#[cfg(debug_assertions)]
#[test]
#[should_panic(expected = "cannot be greater than destination.capacity")]
fn copy_from_panics_when_source_capacity_exceeds_destination() {
    let src_mem = create_mem(MEM_SIZE);
    let src_tb = TripleBufferWriter::new(Arc::clone(&src_mem), 0, 1024);
    let src = DualStoreWriter::<8, 16>::new(
        Arc::clone(&src_mem),
        src_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        8,
    );

    let dst_mem = create_mem(MEM_SIZE);
    let dst_tb = TripleBufferWriter::new(Arc::clone(&dst_mem), 0, 1024);
    let dst = DualStoreWriter::<8, 16>::new(
        Arc::clone(&dst_mem),
        dst_tb.clone(),
        DEFAULT_MEM_START_OFFSET,
        0,
        4,
    );

    dst.copy_from(&src);
}
