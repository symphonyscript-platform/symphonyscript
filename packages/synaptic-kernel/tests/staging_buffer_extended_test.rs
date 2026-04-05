use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::staging_buffer::StagingBuffer;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_list(capacity: usize) -> (StagingBuffer, AtomicBuffer) {
    let size = StagingBuffer::calculate_size_on_mem(capacity);
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    let mem = Arc::new(vec);
    let list = StagingBuffer::new(Arc::clone(&mem), 0, capacity);
    (list, mem)
}

// ============ copy_from: happy path ============

#[test]
fn copy_from_preserves_active_items() {
    let (src, _) = create_list(4);
    src.push(10);
    src.push(20);
    assert_eq!(src.active_count(), 2);

    let (dst, _) = create_list(8);
    dst.copy_from(&src);

    assert_eq!(dst.active_count(), 2);
    assert_eq!(dst.staged_count(), 0);
    assert_eq!(dst.len(), 2);
}

#[test]
fn copy_from_preserves_staged_items() {
    let (src, _) = create_list(4);
    src.push(10);
    src.push(20);

    // First drain: moves items from active to staged, swaps lists
    let empty: Vec<usize> = src.drain().collect();
    assert!(empty.is_empty());
    assert_eq!(src.staged_count(), 2);
    assert_eq!(src.active_count(), 0);

    let (dst, _) = create_list(8);
    dst.copy_from(&src);

    assert_eq!(dst.staged_count(), 2);
    assert_eq!(dst.active_count(), 0);
    assert_eq!(dst.len(), 2);

    // Drain from dst should yield the copied staged items
    let drained: Vec<usize> = dst.drain().collect();
    assert_eq!(drained, vec![10, 20]);
}

#[test]
fn copy_from_preserves_both_active_and_staged() {
    let (src, _) = create_list(4);

    // Push 2 items, drain (moves to staged), push 1 more (active)
    src.push(10);
    src.push(20);
    let _: Vec<usize> = src.drain().collect(); // toggle: staged = [10, 20]
    src.push(30); // active = [30]

    assert_eq!(src.active_count(), 1);
    assert_eq!(src.staged_count(), 2);

    let (dst, _) = create_list(8);
    dst.copy_from(&src);

    assert_eq!(dst.active_count(), 1);
    assert_eq!(dst.staged_count(), 2);
    assert_eq!(dst.len(), 3);

    // Drain should yield the staged items [10, 20]
    let drained: Vec<usize> = dst.drain().collect();
    assert_eq!(drained, vec![10, 20]);

    // Active item [30] is now staged after drain
    assert_eq!(dst.staged_count(), 1);

    // Second drain yields [30]
    let drained2: Vec<usize> = dst.drain().collect();
    assert_eq!(drained2, vec![30]);

    assert_eq!(dst.len(), 0);
}

// ============ Multi-cycle drain ordering ============

#[test]
fn drain_preserves_insertion_order() {
    let (list, _) = create_list(8);

    list.push(1);
    list.push(2);
    list.push(3);
    list.push(4);

    // First drain: toggles active -> staged, returns nothing (previous list was empty)
    let empty: Vec<usize> = list.drain().collect();
    assert!(empty.is_empty());

    // Second drain: returns items in insertion order
    let drained: Vec<usize> = list.drain().collect();
    assert_eq!(drained, vec![1, 2, 3, 4]);
}

#[test]
fn three_cycle_push_drain_interleaving() {
    let (list, _) = create_list(4);

    // Cycle 1: push A, B
    list.push(10);
    list.push(20);
    let d1: Vec<usize> = list.drain().collect(); // toggles, returns empty
    assert!(d1.is_empty());

    // Cycle 2: push C, drain returns [A, B]
    list.push(30);
    let d2: Vec<usize> = list.drain().collect();
    assert_eq!(d2, vec![10, 20]);

    // Cycle 3: push D, drain returns [C]
    list.push(40);
    let d3: Vec<usize> = list.drain().collect();
    assert_eq!(d3, vec![30]);

    // Cycle 4: drain returns [D]
    let d4: Vec<usize> = list.drain().collect();
    assert_eq!(d4, vec![40]);

    assert_eq!(list.len(), 0);
}

// ============ Bind ============

#[test]
fn bind_reads_existing_state() {
    let size = StagingBuffer::calculate_size_on_mem(4);
    let mem: AtomicBuffer = Arc::new(
        (0..size).map(|_| AtomicI32::new(0)).collect(),
    );

    let list1 = StagingBuffer::new(Arc::clone(&mem), 0, 4);
    list1.push(42);
    list1.push(99);

    // Bind to same memory — should see existing state
    let list2 = StagingBuffer::bind(Arc::clone(&mem), 0, 4);
    assert_eq!(list2.active_count(), 2);
    assert_eq!(list2.len(), 2);
}

// ============ Capacity boundary ============

#[test]
fn push_exactly_to_capacity_succeeds() {
    let (list, _) = create_list(4);
    list.push(1);
    list.push(2);
    list.push(3);
    list.push(4);
    assert_eq!(list.active_count(), 4);
}

#[test]
fn drain_resets_count_allowing_reuse() {
    let (list, _) = create_list(2);
    list.push(1);
    list.push(2);
    assert_eq!(list.active_count(), 2);

    let _: Vec<usize> = list.drain().collect(); // toggle
    assert_eq!(list.active_count(), 0);

    // Can push again to the now-current list
    list.push(3);
    list.push(4);
    assert_eq!(list.active_count(), 2);

    // Drain the staged items from first batch
    let drained: Vec<usize> = list.drain().collect();
    assert_eq!(drained, vec![1, 2]);
}

// ============ Nonzero start offset ============

#[test]
fn nonzero_start_offset_works() {
    let size = StagingBuffer::calculate_size_on_mem(4) + 100;
    let mem: AtomicBuffer = Arc::new(
        (0..size).map(|_| AtomicI32::new(0)).collect(),
    );

    let list = StagingBuffer::new(Arc::clone(&mem), 100, 4);
    list.push(42);
    assert_eq!(list.active_count(), 1);

    let _: Vec<usize> = list.drain().collect();
    let drained: Vec<usize> = list.drain().collect();
    assert_eq!(drained, vec![42]);
}
