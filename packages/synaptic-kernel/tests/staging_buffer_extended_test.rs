use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::staging_buffer_reader::StagingBufferReader;
use synaptic_kernel::primitives::staging_buffer_writer::StagingBufferWriter;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_staging(capacity: usize) -> (StagingBufferWriter, StagingBufferReader, AtomicBuffer) {
    let size = StagingBufferWriter::calculate_size_on_mem(capacity);
    let mem: AtomicBuffer = (0..size).map(|_| AtomicI32::new(0)).collect();
    let buffer = StagingBufferWriter::new(Arc::clone(&mem), 0, capacity);
    let reader = buffer.to_reader();
    (buffer, reader, mem)
}

// ============ copy_from: generation-aware ============

#[test]
fn copy_from_preserves_pending_entries_and_generations() {
    let (src, _, _) = create_staging(4);

    // Push A, B with gen 1
    src.push(10).unwrap();
    src.push(20).unwrap();
    src.publish(); // gen → 2

    // Push C with gen 2
    src.push(30).unwrap();

    let (dst, reader, _) = create_staging(8);
    dst.copy_from(&src);

    assert_eq!(dst.len(), 3);
    assert_eq!(dst.writer_generation(), 2); // copied from src

    // Ack gen 1 → drain A, B
    reader.ack(); // acks writer_gen-1 = 1
    let d1: Vec<usize> = dst.drain().collect();
    assert_eq!(d1, vec![10, 20]);

    // C (gen 2) still in buffer
    assert_eq!(dst.len(), 1);
}

#[test]
fn copy_from_to_larger_capacity() {
    let (src, src_reader, _) = create_staging(4);

    src.push(1).unwrap();
    src.push(2).unwrap();
    src.publish(); // gen → 2
    src_reader.ack(); // acks 1

    // Drain gen 1
    let d: Vec<usize> = src.drain().collect();
    assert_eq!(d, vec![1, 2]);

    // Push more
    src.push(3).unwrap();
    src.push(4).unwrap();
    src.publish(); // gen → 3

    let (dst, dst_reader, _) = create_staging(8);
    dst.copy_from(&src);

    assert_eq!(dst.len(), 2); // 3, 4
    assert_eq!(dst.writer_generation(), 3);
    assert_eq!(dst.reader_ack_generation(), 1); // copied ack

    // Ack up to gen 2
    dst_reader.ack(); // acks writer_gen-1 = 2
    let d2: Vec<usize> = dst.drain().collect();
    assert_eq!(d2, vec![3, 4]);
}

// ============ Multi-cycle ordering ============

#[test]
fn drain_preserves_insertion_order_across_generations() {
    let (buf, reader, _) = create_staging(16);

    buf.push(1).unwrap();
    buf.push(2).unwrap();
    buf.publish(); // gen → 2

    buf.push(3).unwrap();
    buf.push(4).unwrap();
    buf.publish(); // gen → 3

    // Ack all
    reader.ack(); // acks 2

    let drained: Vec<usize> = buf.drain().collect();
    assert_eq!(drained, vec![1, 2, 3, 4]); // FIFO order preserved
}

#[test]
fn interleaved_push_publish_ack_drain() {
    let (buf, reader, _) = create_staging(8);

    // Cycle 1
    buf.push(10).unwrap();
    buf.publish(); // gen → 2

    // Ack gen 1, drain
    reader.ack(); // acks 1
    let d1: Vec<usize> = buf.drain().collect();
    assert_eq!(d1, vec![10]);

    // Cycle 2
    buf.push(20).unwrap();
    buf.push(30).unwrap();
    buf.publish(); // gen → 3

    // Ack gen 2, drain
    reader.ack(); // acks 2
    let d2: Vec<usize> = buf.drain().collect();
    assert_eq!(d2, vec![20, 30]);

    // Cycle 3: empty publish
    buf.publish(); // gen → 4
    reader.ack(); // acks 3
    let d3: Vec<usize> = buf.drain().collect();
    assert!(d3.is_empty());

    assert_eq!(buf.len(), 0);
}

// ============ Bind preserves generation state ============

#[test]
fn bind_preserves_generation_state() {
    let size = StagingBufferWriter::calculate_size_on_mem(4);
    let mem: AtomicBuffer = (0..size).map(|_| AtomicI32::new(0)).collect();

    let buf1 = StagingBufferWriter::new(Arc::clone(&mem), 0, 4);
    buf1.push(42).unwrap();
    buf1.publish();
    buf1.push(99).unwrap();
    buf1.publish();

    let buf2 = StagingBufferWriter::bind(Arc::clone(&mem), 0, 4);
    assert_eq!(buf2.len(), 2);
    assert_eq!(buf2.writer_generation(), 3);
}

// ============ Stress: many cycles ============

#[test]
fn many_push_publish_ack_drain_cycles() {
    let (buf, reader, _) = create_staging(16);

    for i in 0..50 {
        buf.push(i).unwrap();
        buf.publish();
        reader.ack();
        let drained: Vec<usize> = buf.drain().collect();
        assert_eq!(drained, vec![i], "cycle {}", i);
    }

    assert_eq!(buf.len(), 0);
    assert_eq!(buf.writer_generation(), 51);
}

#[test]
fn batch_push_then_batch_drain() {
    let (buf, reader, _) = create_staging(16);

    // Push 8 items across 4 publish cycles
    for i in 0..4 {
        buf.push(i * 2).unwrap();
        buf.push(i * 2 + 1).unwrap();
        buf.publish();
    }

    assert_eq!(buf.len(), 8);

    // Ack up to gen 4 (all published)
    reader.ack(); // acks writer_gen-1 = 4

    let drained: Vec<usize> = buf.drain().collect();
    assert_eq!(drained, vec![0, 1, 2, 3, 4, 5, 6, 7]);
    assert_eq!(buf.len(), 0);
}

// ============ Edge: ack before any publish ============

#[test]
fn ack_before_any_publish_is_noop() {
    let (buf, reader, _) = create_staging(4);

    buf.push(10).unwrap();

    // Writer gen is 1, reader.ack() → acks 0. Gen 1 > Gen 0 -> noop
    reader.ack();

    // Drain yields nothing
    let drained: Vec<usize> = buf.drain().collect();
    assert!(drained.is_empty());
}

// ============ Edge: publish without push between acks ============

#[test]
fn empty_publish_cycles_dont_break_generation_tracking() {
    let (buf, reader, _) = create_staging(8);

    buf.push(1).unwrap();
    buf.publish(); // gen → 2

    // Empty publishes
    buf.publish(); // gen → 3
    buf.publish(); // gen → 4

    buf.push(2).unwrap(); // stamped gen 4
    buf.publish(); // gen → 5

    // Ack gen 4
    reader.ack(); // acks writer_gen-1 = 4

    let drained: Vec<usize> = buf.drain().collect();
    assert_eq!(drained, vec![1, 2]); // both acked (gen 1 <= 4, gen 4 <= 4)
}
