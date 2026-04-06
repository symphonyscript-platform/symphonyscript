use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::primitives::slot_allocator::SlotAllocator;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_allocator(capacity: usize) -> (SlotAllocator, AtomicBuffer) {
    let size = SlotAllocator::calculate_size_on_mem(capacity);
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    let mem = Arc::new(vec);
    let alloc = SlotAllocator::new(Arc::clone(&mem), 0, capacity);
    (alloc, mem)
}

// ============ State transitions: is_active / is_deferred / is_free ============

#[test]
fn fresh_allocator_all_slots_free() {
    let (alloc, _) = create_allocator(4);
    // Slots are 1-based
    for i in 1..=4 {
        assert!(alloc.is_free(i), "slot {} should be free", i);
        assert!(!alloc.is_allocated(i), "slot {} should not be allocated", i);
    }
}

#[test]
fn after_alloc_slot_is_active() {
    let (alloc, _) = create_allocator(4);
    let s = alloc.alloc().unwrap();

    assert!(alloc.is_allocated(s));
    assert!(alloc.is_active(s));
    assert!(!alloc.is_deferred(s));
    assert!(!alloc.is_free(s));
}

#[test]
fn after_defer_slot_is_deferred_not_active() {
    let (alloc, _) = create_allocator(4);
    let s = alloc.alloc().unwrap();

    alloc.defer_free(s).unwrap();

    assert!(alloc.is_allocated(s), "still allocated (hasn't been freed yet)");
    assert!(alloc.is_deferred(s), "marked as deferred");
    assert!(!alloc.is_active(s), "not active (deferred takes precedence)");
    assert!(!alloc.is_free(s), "not free (still in alloc bitmap)");
}

#[test]
fn after_single_flush_slot_still_deferred() {
    let (alloc, _) = create_allocator(4);
    let s = alloc.alloc().unwrap();
    alloc.defer_free(s).unwrap();

    // First flush: moves deferred from active list to staged list
    alloc.publish();

    // Slot is still allocated — staging buffer hasn't drained the staged items yet
    assert!(alloc.is_allocated(s));
}

#[test]
fn after_two_flushes_slot_is_fully_free() {
    let (alloc, _) = create_allocator(4);
    let s = alloc.alloc().unwrap();
    alloc.defer_free(s).unwrap();

    alloc.publish(); // toggle: deferred -> staged
    alloc.publish(); // drain staged, free the slots

    assert!(alloc.is_free(s), "slot should be fully free after 2 flushes");
    assert!(!alloc.is_allocated(s));
    assert!(!alloc.is_deferred(s));
}

// ============ copy_from (growth scenario) ============

#[test]
fn copy_from_preserves_state_and_adds_capacity() {
    let (small, _) = create_allocator(4);

    let s1 = small.alloc().unwrap();
    let s2 = small.alloc().unwrap();
    let _s3 = small.alloc().unwrap();

    small.defer_free(s2).unwrap();

    assert_eq!(small.alloc_count(), 3);
    assert_eq!(small.deferred_count(), 1);

    // Create larger allocator and copy
    let large_size = SlotAllocator::calculate_size_on_mem(8);
    let large_mem: AtomicBuffer = Arc::new(
        (0..large_size).map(|_| AtomicI32::new(0)).collect(),
    );
    let large = SlotAllocator::new(Arc::clone(&large_mem), 0, 8);
    large.copy_from(&small);

    // Verify: alloc count should be same, free count should include new capacity
    assert_eq!(large.alloc_count(), 3);
    assert_eq!(large.capacity(), 8);

    // Verify the deferred state was copied
    assert_eq!(large.deferred_count(), 1);

    // s1 should still be active
    assert!(large.is_active(s1));

    // s2 should still be deferred
    assert!(large.is_deferred(s2));

    // New slots (5-8) should be allocatable
    let s5 = large.alloc().unwrap();
    assert!(s5 >= 1 && s5 <= 8);
}

#[test]
fn copy_from_deferred_items_flush_correctly_on_destination() {
    let (small, _) = create_allocator(4);

    let s1 = small.alloc().unwrap();
    let s2 = small.alloc().unwrap();
    small.defer_free(s1).unwrap();
    small.defer_free(s2).unwrap();

    let large_size = SlotAllocator::calculate_size_on_mem(8);
    let large_mem: AtomicBuffer = Arc::new(
        (0..large_size).map(|_| AtomicI32::new(0)).collect(),
    );
    let large = SlotAllocator::new(Arc::clone(&large_mem), 0, 8);
    large.copy_from(&small);

    // Flush on destination should work correctly
    large.publish();
    large.publish();

    assert_eq!(large.deferred_count(), 0);
    assert!(large.is_free(s1));
    assert!(large.is_free(s2));
}

#[test]
#[should_panic]
fn copy_from_panics_if_source_larger() {
    let (large, _) = create_allocator(8);
    let (small, _) = create_allocator(4);
    small.copy_from(&large);
}

// ============ Stress: rapid alloc/defer/flush cycles ============

#[test]
fn stress_alloc_defer_flush_cycles() {
    let (alloc, _) = create_allocator(64);

    for _cycle in 0..50 {
        // Alloc some slots
        let mut slots = Vec::new();
        for _ in 0..16 {
            if let Some(s) = alloc.alloc() {
                slots.push(s);
            }
        }

        // Defer half
        for s in slots.iter().take(slots.len() / 2) {
            alloc.defer_free(*s).unwrap();
        }

        // Flush (2x for full reclamation)
        alloc.publish();
        alloc.publish();

        // Invariant: free_count + alloc_count == capacity
        assert_eq!(
            alloc.free_count() + alloc.alloc_count(),
            64,
            "invariant violated in cycle {}",
            _cycle
        );

        // Free the non-deferred slots directly via defer+flush
        for s in slots.iter().skip(slots.len() / 2) {
            alloc.defer_free(*s).unwrap();
        }
        alloc.publish();
        alloc.publish();
    }

    // At the end, everything should be free
    assert_eq!(alloc.free_count(), 64);
    assert_eq!(alloc.alloc_count(), 0);
    assert_eq!(alloc.deferred_count(), 0);
}

#[test]
fn stress_interleaved_alloc_defer_with_partial_flush() {
    let (alloc, _) = create_allocator(32);

    let mut active: Vec<usize> = Vec::new();

    for i in 0..200 {
        if active.len() < 32 && i % 3 != 0 {
            if let Some(s) = alloc.alloc() {
                active.push(s);
            }
        } else if !active.is_empty() {
            let s = active.remove(0);
            alloc.defer_free(s).unwrap();
        }

        // Flush every 5th iteration (partial drains)
        if i % 5 == 0 {
            alloc.publish();
        }
    }

    // Final cleanup
    for s in active {
        alloc.defer_free(s).unwrap();
    }
    alloc.publish();
    alloc.publish();

    assert_eq!(alloc.free_count(), 32);
    assert_eq!(alloc.deferred_count(), 0);
}

// ============ Utilization ============

#[test]
fn utilization_tracks_allocation_ratio() {
    let (alloc, _) = create_allocator(4);
    assert_eq!(alloc.utilization(), 0.0);

    alloc.alloc().unwrap();
    assert_eq!(alloc.utilization(), 0.25);

    alloc.alloc().unwrap();
    assert_eq!(alloc.utilization(), 0.5);

    alloc.alloc().unwrap();
    alloc.alloc().unwrap();
    assert_eq!(alloc.utilization(), 1.0);
}

// ============ Bind ============

#[test]
fn bind_reads_existing_allocator_state() {
    let size = SlotAllocator::calculate_size_on_mem(4);
    let mem: AtomicBuffer = Arc::new(
        (0..size).map(|_| AtomicI32::new(0)).collect(),
    );

    let alloc1 = SlotAllocator::new(Arc::clone(&mem), 0, 4);
    let _s1 = alloc1.alloc().unwrap();
    let _s2 = alloc1.alloc().unwrap();
    assert_eq!(alloc1.alloc_count(), 2);

    let alloc2 = SlotAllocator::bind(Arc::clone(&mem), 0, 4);
    assert_eq!(alloc2.alloc_count(), 2);
    assert_eq!(alloc2.free_count(), 2);
}
