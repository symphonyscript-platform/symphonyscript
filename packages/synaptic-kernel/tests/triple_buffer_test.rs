use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Arc;
use std::thread;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ Happy Paths ============

#[test]
fn new_creates_writer_and_reader() {
    let mem = create_mem(4096);
    let (writer, reader) = TripleBuffer::new(mem, 0, 10);
    assert_eq!(writer.buffer_capacity(), 10);
    assert_eq!(reader.buffer_capacity(), 10);
}

#[test]
fn writer_can_write_and_publish() {
    let mem = create_mem(4096);
    let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, 4);

    let base = writer.current_start_index();
    mem[base].store(42, Ordering::Relaxed);
    mem[base + 1].store(99, Ordering::Relaxed);
    writer.publish();
}

#[test]
fn reader_sees_published_data() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write data to writer buffer
    let base = writer.current_start_index();
    mem[base].store(100, Ordering::Relaxed);
    mem[base + 1].store(200, Ordering::Relaxed);
    mem[base + 2].store(300, Ordering::Relaxed);
    mem[base + 3].store(400, Ordering::Relaxed);

    // Publish
    writer.publish();

    // Reader swaps — should get published data
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 100);
    assert_eq!(mem[rbase + 1].load(Ordering::Relaxed), 200);
    assert_eq!(mem[rbase + 2].load(Ordering::Relaxed), 300);
    assert_eq!(mem[rbase + 3].load(Ordering::Relaxed), 400);
}

#[test]
fn reader_swap_returns_false_when_no_new_data() {
    let mem = create_mem(4096);
    let (_writer, mut reader) = TripleBuffer::new(mem, 0, 4);

    // No publish happened — reader should get false
    assert!(!reader.swap());
}

#[test]
fn reader_swap_returns_true_when_new_data() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem, 0, 4);

    writer.publish();
    assert!(reader.swap());
}

#[test]
fn multiple_publish_reader_gets_latest() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write #1
    let base1 = writer.current_start_index();
    mem[base1].store(111, Ordering::Relaxed);
    writer.publish();

    // Write #2 (overwrites shared before reader consumes)
    let base2 = writer.current_start_index();
    mem[base2].store(222, Ordering::Relaxed);
    writer.publish();

    // Reader should see 222 (latest), not 111
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 222);
}

#[test]
fn reader_keeps_old_data_when_no_new_publish() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Publish once
    let base = writer.current_start_index();
    mem[base].store(42, Ordering::Relaxed);
    writer.publish();

    // Reader swaps
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 42);

    // No new publish — reader swap returns false, keeps same data
    assert!(!reader.swap());
    let rbase2 = reader.current_start_index();
    assert_eq!(rbase2, rbase); // same buffer
    assert_eq!(mem[rbase2].load(Ordering::Relaxed), 42);
}

#[test]
fn full_cycle_writer_reader_writer() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Cycle 1
    let b1 = writer.current_start_index();
    mem[b1].store(10, Ordering::Relaxed);
    writer.publish();
    assert!(reader.swap());
    let rbase1 = reader.current_start_index();
    assert_eq!(mem[rbase1].load(Ordering::Relaxed), 10);

    // Cycle 2
    let b2 = writer.current_start_index();
    assert_ne!(b1, b2, "Writer should get a new buffer");
    mem[b2].store(20, Ordering::Relaxed);
    writer.publish();
    assert!(reader.swap());
    let rbase2 = reader.current_start_index();
    assert_ne!(rbase1, rbase2, "Reader should get a new buffer");
    assert_eq!(mem[rbase2].load(Ordering::Relaxed), 20);

    // Cycle 3
    let b3 = writer.current_start_index();
    assert_ne!(b2, b3, "Writer should get a new buffer");
    assert_ne!(b1, b3, "Writer should get a new buffer");
    mem[b3].store(30, Ordering::Relaxed);
    writer.publish();
    assert!(reader.swap());
    let rbase3 = reader.current_start_index();
    assert_ne!(rbase2, rbase3, "Reader should get a new buffer");
    assert_ne!(rbase1, rbase3, "Reader should get a new buffer");
    assert_eq!(mem[rbase3].load(Ordering::Relaxed), 30);
}

#[test]
fn mem_end_offset_is_correct() {
    let mem = create_mem(4096);
    let (writer, reader) = TripleBuffer::new(mem, 0, 10);

    // Layout: 4 metadata slots + 3 × 10 buffer slots = 34
    assert_eq!(writer.mem_end_offset(), 4 + 3 * 10);
    assert_eq!(reader.mem_end_offset(), 4 + 3 * 10);
}

#[test]
fn nonzero_start_index() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 100, 8);

    assert_eq!(writer.mem_end_offset(), 100 + 4 + 3 * 8);
    assert_eq!(reader.mem_end_offset(), 100 + 4 + 3 * 8);

    let base = writer.current_start_index();
    assert!(base >= 104); // at least after metadata
    mem[base].store(55, Ordering::Relaxed);
    writer.publish();

    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 55);
}

// ============ Edge Cases ============

#[test]
fn buffer_size_of_one() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 1);

    let base = writer.current_start_index();
    mem[base].store(777, Ordering::Relaxed);
    writer.publish();

    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 777);
}

#[test]
fn writer_publishes_many_times_without_reader_consuming() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Writer publishes 10 times without reader ever swapping
    for i in 0..10 {
        let base = writer.current_start_index();
        mem[base].store(i * 100, Ordering::Relaxed);
        writer.publish();
    }

    // Reader should see latest (900)
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 900);
}

#[test]
fn reader_swaps_many_times_without_new_publishes() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Publish once
    let base = writer.current_start_index();
    mem[base].store(42, Ordering::Relaxed);
    writer.publish();

    // Reader swaps first time — gets data
    assert!(reader.swap());

    // Reader swaps 10 more times — all return false
    for _ in 0..10 {
        assert!(!reader.swap());
    }
}

#[test]
fn writer_reader_alternating_rapidly() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 2);

    for i in 0..100 {
        let base = writer.current_start_index();
        mem[base].store(i, Ordering::Relaxed);
        mem[base + 1].store(i * 10, Ordering::Relaxed);
        writer.publish();

        assert!(reader.swap());
        let rbase = reader.current_start_index();
        assert_eq!(mem[rbase].load(Ordering::Relaxed), i);
        assert_eq!(mem[rbase + 1].load(Ordering::Relaxed), i * 10);
    }
}

#[test]
fn all_three_buffers_are_distinct() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    let mut seen_bases = std::collections::HashSet::new();

    // Init: writer=0, shared=1, reader=2
    // Writer starts with buffer 0
    seen_bases.insert(writer.current_start_index());

    // Publish: writer gives 0 to shared, takes 1. Now writer=1, shared=0, reader=2
    writer.publish();
    seen_bases.insert(writer.current_start_index());

    // Reader swaps: reader gives 2 to shared, takes 0. Now writer=1, shared=2, reader=0
    reader.swap();
    seen_bases.insert(reader.current_start_index());

    // Publish: writer gives 1 to shared, takes 2. Now writer=2, shared=1, reader=0
    writer.publish();
    seen_bases.insert(writer.current_start_index());

    // All three buffers should have been observed
    assert_eq!(
        seen_bases.len(),
        3,
        "expected 3 distinct buffer bases, got {:?}",
        seen_bases
    );
}

#[test]
fn writer_buffer_sync_after_publish() {
    let mem = create_mem(4096);
    let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write data to writer buffer
    let base1 = writer.current_start_index();
    mem[base1].store(111, Ordering::Relaxed);
    mem[base1 + 1].store(222, Ordering::Relaxed);
    mem[base1 + 2].store(333, Ordering::Relaxed);
    mem[base1 + 3].store(444, Ordering::Relaxed);

    // Publish — the sync inside publish() should copy data to the new writer buffer
    writer.publish();

    let base2 = writer.current_start_index();
    assert_ne!(base1, base2); // different buffer

    // New writer buffer should have the synced data
    assert_eq!(mem[base2].load(Ordering::Relaxed), 111);
    assert_eq!(mem[base2 + 1].load(Ordering::Relaxed), 222);
    assert_eq!(mem[base2 + 2].load(Ordering::Relaxed), 333);
    assert_eq!(mem[base2 + 3].load(Ordering::Relaxed), 444);
}

#[test]
fn sync_correctness_across_multiple_publishes() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write field 0 = 10
    let base = writer.current_start_index();
    mem[base].store(10, Ordering::Relaxed);
    writer.publish();

    // After sync, writer's new buffer should have field 0 = 10
    let base = writer.current_start_index();
    assert_eq!(mem[base].load(Ordering::Relaxed), 10);

    // Now update field 1 = 20, keep field 0 as synced
    mem[base + 1].store(20, Ordering::Relaxed);
    writer.publish();

    // Both fields should persist in new writer
    let base = writer.current_start_index();
    assert_eq!(mem[base].load(Ordering::Relaxed), 10);
    assert_eq!(mem[base + 1].load(Ordering::Relaxed), 20);

    // Reader should see both fields
    reader.swap();
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 10);
    assert_eq!(mem[rbase + 1].load(Ordering::Relaxed), 20);
}

#[test]
fn incremental_writes_dont_lose_prior_data() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 8);

    // Write all 8 fields
    let base = writer.current_start_index();
    for i in 0..8 {
        mem[base + i].store((i + 1) as i32 * 100, Ordering::Relaxed);
    }
    writer.publish();
    reader.swap();

    // Reader sees all 8
    let rbase = reader.current_start_index();
    for i in 0..8 {
        assert_eq!(mem[rbase + i].load(Ordering::Relaxed), (i + 1) as i32 * 100);
    }

    // Now only update field 3
    let base = writer.current_start_index();
    mem[base + 3].store(999, Ordering::Relaxed);
    writer.publish();
    reader.swap();

    // Reader should see field 3 changed, others preserved
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 100);
    assert_eq!(mem[rbase + 1].load(Ordering::Relaxed), 200);
    assert_eq!(mem[rbase + 2].load(Ordering::Relaxed), 300);
    assert_eq!(mem[rbase + 3].load(Ordering::Relaxed), 999); // updated
    assert_eq!(mem[rbase + 4].load(Ordering::Relaxed), 500);
    assert_eq!(mem[rbase + 5].load(Ordering::Relaxed), 600);
    assert_eq!(mem[rbase + 6].load(Ordering::Relaxed), 700);
    assert_eq!(mem[rbase + 7].load(Ordering::Relaxed), 800);
}

// ============ Bind (Reconnect to Existing AtomicBuffer) ============

#[test]
fn bind_reconnects_to_existing_state() {
    let mem = create_mem(4096);
    let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write and publish
    let base = writer.current_start_index();
    mem[base].store(42, Ordering::Relaxed);
    writer.publish();

    // Bind new reader to same AtomicBuffer region
    let mut reader2 = TripleBuffer::bind_reader(mem.clone(), 0, 4);

    // Reader2 should see the published data
    assert!(reader2.swap());
    let rbase = reader2.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 42);
}

#[test]
fn bind_does_not_reinitialize_state() {
    let mem = create_mem(4096);
    let state_slot = 0;

    // Initialize
    let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, 4);
    let base = writer.current_start_index();
    mem[base].store(99, Ordering::Relaxed);
    writer.publish();

    // Capture state before bind
    let state_before = mem[state_slot].load(Ordering::Relaxed);

    // Bind — should NOT overwrite state
    let _writer2 = TripleBuffer::bind_writer(mem.clone(), 0, 4);
    let _reader2 = TripleBuffer::bind_reader(mem.clone(), 0, 4);
    let state_after = mem[state_slot].load(Ordering::Relaxed);

    assert_eq!(state_before, state_after);
}

// ============ Super Edge Cases ============

#[test]
fn dropped_frames_preserve_cumulative_state() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Frame 1: set field 0 = 10
    let base = writer.current_start_index();
    mem[base].store(10, Ordering::Relaxed);
    writer.publish();

    // Frame 2: set field 1 = 20 (field 0 synced from previous)
    let base = writer.current_start_index();
    mem[base + 1].store(20, Ordering::Relaxed);
    writer.publish();

    // Frame 3: set field 2 = 30
    let base = writer.current_start_index();
    mem[base + 2].store(30, Ordering::Relaxed);
    writer.publish();

    // Reader only swaps ONCE — should see cumulative state
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    assert_eq!(mem[rbase].load(Ordering::Relaxed), 10);
    assert_eq!(mem[rbase + 1].load(Ordering::Relaxed), 20);
    assert_eq!(mem[rbase + 2].load(Ordering::Relaxed), 30);
}

#[test]
fn writer_and_reader_never_see_same_buffer() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    for _ in 0..50 {
        // Writer writes and publishes
        writer.publish();
        reader.swap();

        // Writer and reader should NEVER have the same base
        assert_ne!(
            writer.current_start_index(),
            reader.current_start_index(),
            "writer and reader must never share a buffer"
        );
    }
}

#[test]
fn published_slot_index_tracks_latest_publish() {
    let mem = create_mem(4096);
    let published_slot = 2; // mem_start_offset + 2

    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Initially 0
    assert_eq!(
        mem[published_slot].load(Ordering::Relaxed),
        0,
        "initially 0"
    );

    // After 1st publish (writer had buffer 0)
    writer.publish();
    assert_eq!(
        mem[published_slot].load(Ordering::Relaxed),
        0,
        "published 0"
    );

    // Let reader swap so writer gets a new buffer
    reader.swap();

    // After 2nd publish (writer had buffer 1)
    writer.publish();
    assert_eq!(
        mem[published_slot].load(Ordering::Relaxed),
        1,
        "published 1"
    );

    // Let reader swap
    reader.swap();

    // After 3rd publish (writer had buffer 2)
    writer.publish();
    assert_eq!(
        mem[published_slot].load(Ordering::Relaxed),
        2,
        "published 2"
    );
}

#[test]
fn state_encoding_new_data_flag() {
    let mem = create_mem(4096);
    let state_slot = 0;

    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Initial state: NEW_DATA bit should be set (0b100) because initial state is 0b001
    // Actually initial state: state = 0b001 (shared=1, no new data — wait, the init sets 0b001)
    let state = mem[state_slot].load(Ordering::Relaxed);
    // Init: state = 0b001 → shared_idx=1, NEW_DATA=0
    assert_eq!(state & 0b100, 0, "no new data initially");

    // After publish: NEW_DATA should be set
    writer.publish();
    let state = mem[state_slot].load(Ordering::Relaxed);
    assert_ne!(state & 0b100, 0, "NEW_DATA set after publish");

    // After reader swap: NEW_DATA should be cleared
    reader.swap();
    let state = mem[state_slot].load(Ordering::Relaxed);
    assert_eq!(state & 0b100, 0, "NEW_DATA cleared after reader swap");
}

#[test]
fn large_buffer_data_integrity() {
    let buffer_size = 1024;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    // Write a pattern to all slots
    let base = writer.current_start_index();
    for i in 0..buffer_size {
        mem[base + i].store((i as i32) * 7 + 3, Ordering::Relaxed);
    }
    writer.publish();

    // Reader should see the exact pattern
    assert!(reader.swap());
    let rbase = reader.current_start_index();
    for i in 0..buffer_size {
        assert_eq!(
            mem[rbase + i].load(Ordering::Relaxed),
            (i as i32) * 7 + 3,
            "mismatch at index {i}"
        );
    }
}

#[test]
fn sync_preserves_data_through_all_three_buffers() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Write data, publish, reader consumes — exercising all 3 buffers
    let mut expected = [0i32; 4];

    for round in 0..6 {
        let base = writer.current_start_index();

        // Each round, update one field
        let field = round % 4;
        expected[field] = (round + 1) as i32 * 100;
        mem[base + field].store(expected[field], Ordering::Relaxed);

        writer.publish();
        assert!(reader.swap());

        let rbase = reader.current_start_index();
        for f in 0..4 {
            assert_eq!(
                mem[rbase + f].load(Ordering::Relaxed),
                expected[f],
                "round {round}, field {f}: expected {}, got {}",
                expected[f],
                mem[rbase + f].load(Ordering::Relaxed)
            );
        }
    }
}

#[test]
fn concurrent_writer_reader_stress() {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);

    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    let mem_writer = mem.clone();
    let mem_reader = mem.clone();
    let iterations = 10_000;

    // Writer thread: write incrementing values, publish
    let writer_handle = thread::spawn(move || {
        for i in 0..iterations {
            let base = writer.current_start_index();
            // Write a sentinel pattern: [i, i, i, ..., i]
            for j in 0..buffer_size {
                mem_writer[base + j].store(i as i32, Ordering::Relaxed);
            }
            writer.publish();
        }
    });

    // Reader thread: swap and verify consistency within each frame
    let reader_handle = thread::spawn(move || {
        let mut frames_read = 0u64;
        let mut last_val = -1i32;

        for _ in 0..iterations * 2 {
            if reader.swap() {
                let rbase = reader.current_start_index();
                let first = mem_reader[rbase].load(Ordering::Relaxed);

                // Data is written in monotonically increasing order. The protocol
                // guarantees the reader only gets newer frames (or the same frame),
                // so it must never see a value from the past.
                assert!(
                    first >= last_val,
                    "reader went backwards in time: got {first}, expected >= {last_val}"
                );
                last_val = first;

                // All values in the frame should be the same (consistency)
                for j in 1..buffer_size {
                    let val = mem_reader[rbase + j].load(Ordering::Relaxed);
                    assert_eq!(
                        val, first,
                        "torn frame at index {j}: got {val}, expected {first}"
                    );
                }

                frames_read += 1;
            }
            // Small yield to allow interleaving
            thread::yield_now();
        }

        assert!(
            frames_read > 0,
            "reader should have consumed at least one frame"
        );
        frames_read
    });

    writer_handle.join().expect("writer panicked");
    let frames = reader_handle.join().expect("reader panicked");
    assert!(frames > 0);
}

#[test]
fn concurrent_high_frequency_publish() {
    let buffer_size = 8;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    let mem_w = mem.clone();
    let mem_r = mem.clone();

    // Writer publishes as fast as possible
    let writer_handle = thread::spawn(move || {
        for i in 0..50_000i32 {
            let base = writer.current_start_index();
            mem_w[base].store(i, Ordering::Relaxed);
            writer.publish();
        }
    });

    // Reader swaps periodically
    let reader_handle = thread::spawn(move || {
        let mut reads = 0u64;
        for _ in 0..5_000 {
            if reader.swap() {
                let rbase = reader.current_start_index();
                let _val = mem_r[rbase].load(Ordering::Relaxed);
                reads += 1;
            }
            thread::yield_now();
        }
        reads
    });

    writer_handle.join().expect("writer panicked");
    let reads = reader_handle.join().expect("reader panicked");
    // Reader should see some frames (dropped frames are expected)
    assert!(reads > 0, "reader saw zero frames");
}

#[test]
fn writer_gets_back_coherent_buffer_after_reader_consumes() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Round 1: writer writes [1, 2, 3, 4], publishes, reader consumes
    let base = writer.current_start_index();
    for i in 0..4 {
        mem[base + i].store((i + 1) as i32, Ordering::Relaxed);
    }
    writer.publish();
    reader.swap();

    // Round 2: writer writes [5, 6, 7, 8], publishes, reader consumes
    let base = writer.current_start_index();
    for i in 0..4 {
        mem[base + i].store((i + 5) as i32, Ordering::Relaxed);
    }
    writer.publish();
    reader.swap();

    // Round 3: writer's buffer should be synced (should have [5, 6, 7, 8])
    // because publish() syncs the stale writer from the published buffer
    let base = writer.current_start_index();
    assert_eq!(mem[base].load(Ordering::Relaxed), 5);
    assert_eq!(mem[base + 1].load(Ordering::Relaxed), 6);
    assert_eq!(mem[base + 2].load(Ordering::Relaxed), 7);
    assert_eq!(mem[base + 3].load(Ordering::Relaxed), 8);
}

#[test]
fn two_triple_buffers_on_same_mem() {
    let mem = create_mem(8192);

    // First triple buffer at offset 0, size 10
    let (mut w1, mut r1) = TripleBuffer::new(mem.clone(), 0, 10);
    // Second triple buffer at offset after first one ends
    let offset2 = w1.mem_end_offset();
    let (mut w2, mut r2) = TripleBuffer::new(mem.clone(), offset2, 8);

    // Write different data to each
    let b1 = w1.current_start_index();
    mem[b1].store(1111, Ordering::Relaxed);
    w1.publish();

    let b2 = w2.current_start_index();
    mem[b2].store(2222, Ordering::Relaxed);
    w2.publish();

    // Each reader sees its own data
    r1.swap();
    r2.swap();

    let rb1 = r1.current_start_index();
    let rb2 = r2.current_start_index();
    assert_eq!(mem[rb1].load(Ordering::Relaxed), 1111);
    assert_eq!(mem[rb2].load(Ordering::Relaxed), 2222);
}

#[test]
fn reader_stability_during_no_publishes() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    // Publish once
    let base = writer.current_start_index();
    mem[base].store(42, Ordering::Relaxed);
    writer.publish();
    reader.swap();

    let rbase = reader.current_start_index();

    // Reader swaps 100 times with no publishes — buffer should be stable
    for _ in 0..100 {
        assert!(!reader.swap());
        assert_eq!(reader.current_start_index(), rbase);
        assert_eq!(mem[rbase].load(Ordering::Relaxed), 42);
    }
}

#[test]
fn publish_swap_publish_swap_never_corrupts() {
    let mem = create_mem(4096);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, 4);

    let mut accumulated = [0i32; 4];

    for round in 0..20 {
        let base = writer.current_start_index();
        accumulated[round % 4] += 1;

        for i in 0..4 {
            mem[base + i].store(accumulated[i], Ordering::Relaxed);
        }

        writer.publish();
        assert!(reader.swap());

        let rbase = reader.current_start_index();
        for i in 0..4 {
            assert_eq!(
                mem[rbase + i].load(Ordering::Relaxed),
                accumulated[i],
                "corruption at round {round}, field {i}"
            );
        }
    }
}

#[test]
fn publish_does_not_corrupt_surrounding_mem_memory() {
    let padding = 100;
    let buffer_size = 64;
    // Layout: padding + 4 metadata slots + 3*64 buffer slots + padding
    let mem = create_mem(padding + 4 + buffer_size * 3 + padding);

    // Fill the ENTIRE AtomicBuffer with a sentinel value
    for i in 0..mem.len() {
        mem[i].store(7777, Ordering::Relaxed);
    }

    let mem_start_offset = padding;
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), mem_start_offset, buffer_size);

    // Perform bulk writes and rapid publishes to heavily exercise the memcpy loop
    for round in 0..10_000 {
        let base = writer.current_start_index();

        // Write pattern into the writer buffer
        for i in 0..buffer_size {
            mem[base + i].store((round as i32) * 100 + (i as i32), Ordering::Relaxed);
        }

        writer.publish();

        // Let the reader swap occasionally to force buffer rotation
        if round % 3 == 0 {
            reader.swap();
        }
    }

    // 1. Verify leading memory is completely untouched
    for i in 0..padding {
        assert_eq!(
            mem[i].load(Ordering::Relaxed),
            7777,
            "Memory corruption (underflow) before mem_start_offset at mem index {i}"
        );
    }

    // 2. Verify trailing memory is completely untouched
    let mem_end_offset = writer.mem_end_offset();
    for i in mem_end_offset..mem.len() {
        assert_eq!(
            mem[i].load(Ordering::Relaxed),
            7777,
            "Memory corruption (overflow) after mem_end_offset at mem index {i}"
        );
    }

    // 3. Verify metadata slots did not get swept up in an overflowing memcpy
    let state = mem[mem_start_offset].load(Ordering::Relaxed);
    assert!((0..=7).contains(&state), "State slot corrupted: {state}");

    let writer_id = mem[mem_start_offset + 1].load(Ordering::Relaxed);
    assert!(
        (0..=2).contains(&writer_id),
        "Writer ID slot corrupted: {writer_id}"
    );

    let published_id = mem[mem_start_offset + 2].load(Ordering::Relaxed);
    assert!(
        (0..=2).contains(&published_id),
        "Published ID slot corrupted: {published_id}"
    );

    let reader_id = mem[mem_start_offset + 3].load(Ordering::Relaxed);
    assert!(
        (0..=2).contains(&reader_id),
        "Reader ID slot corrupted: {reader_id}"
    );
}
