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

#[test]
fn push_and_drain_lifecycle() {
    let (list, _mem) = create_list(4);

    assert_eq!(list.len(), 0);
    assert_eq!(list.active_count(), 0);
    assert_eq!(list.staged_count(), 0);

    list.push(10);
    list.push(20);

    assert_eq!(list.len(), 2);
    assert_eq!(list.active_count(), 2);
    assert_eq!(list.staged_count(), 0);

    let empty_drain: Vec<usize> = list.drain().collect();
    assert!(empty_drain.is_empty());

    assert_eq!(list.len(), 2);
    assert_eq!(list.active_count(), 0);
    assert_eq!(list.staged_count(), 2);

    let drained: Vec<usize> = list.drain().collect();
    assert_eq!(drained, vec![10, 20]);
    
    assert_eq!(list.len(), 0);
}

#[test]
fn over_rotation_draining_empty() {
    let (list, _mem) = create_list(4);
    
    list.drain();
    list.drain();
    list.drain();
    
    // Proves that endless draining cycles safely
    assert_eq!(list.len(), 0);
}

#[test]
#[should_panic]
fn push_panics_if_capacity_exceeded() {
    let (list, _mem) = create_list(2);
    list.push(1);
    list.push(2);
    list.push(3); // panics here
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let (small, _) = create_list(2);
    let (large, _) = create_list(4);
    small.copy_from(&large);
}
