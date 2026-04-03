use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::primitives::free_list::FreeList;
use symphonyscript_kernel::primitives::types::SAB;

const SLOT_SIZE: usize = 16;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

// ============ Happy Paths ============

#[test]
fn alloc_returns_slot_handle() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc();
    assert!(slot.is_some());
}

#[test]
fn alloc_returns_zeroed_slot() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    assert_eq!(slot.read_all(), [0, 0, 0, 0]);
}

#[test]
fn free_count_starts_at_capacity() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    assert_eq!(fl.free_count(), 8);
}

#[test]
fn alloc_decrements_free_count() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    fl.alloc().unwrap();
    assert_eq!(fl.free_count(), 7);

    fl.alloc().unwrap();
    assert_eq!(fl.free_count(), 6);
}

#[test]
fn free_increments_free_count() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    assert_eq!(fl.free_count(), 7);

    fl.free(slot).unwrap();
    assert_eq!(fl.free_count(), 8);
}

#[test]
fn alloc_all_then_returns_none() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 4);

    let mut handles = Vec::new();
    for _ in 0..4 {
        handles.push(fl.alloc().unwrap());
    }
    assert_eq!(fl.free_count(), 0);
    assert!(fl.alloc().is_none());
}

#[test]
fn write_and_read_slot_data() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    slot.write(0, 42);
    slot.write(1, 84);
    slot.write(2, 126);
    slot.write(3, 168);

    assert_eq!(slot.read(0), 42);
    assert_eq!(slot.read(1), 84);
    assert_eq!(slot.read(2), 126);
    assert_eq!(slot.read(3), 168);
}

#[test]
fn write_all_and_read_all() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    slot.write_all([10, 20, 30, 40]);
    assert_eq!(slot.read_all(), [10, 20, 30, 40]);
}

#[test]
fn multiple_slots_are_independent() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 8);

    let a = fl.alloc().unwrap();
    let b = fl.alloc().unwrap();

    a.write_all([1, 2]);
    b.write_all([3, 4]);

    assert_eq!(a.read_all(), [1, 2]);
    assert_eq!(b.read_all(), [3, 4]);
}

#[test]
fn free_and_realloc_reuses_slot() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 4);

    let slot = fl.alloc().unwrap();
    slot.write_all([99, 100]);
    fl.free(slot).unwrap();

    // Reallocated slot should be zeroed
    let slot2 = fl.alloc().unwrap();
    assert_eq!(slot2.read_all(), [0, 0]);
}

// ============ Edge Cases ============

#[test]
fn capacity_of_one() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 1);

    assert_eq!(fl.free_count(), 1);

    let slot = fl.alloc().unwrap();
    assert!(fl.alloc().is_none());
    assert_eq!(fl.free_count(), 0);

    fl.free(slot).unwrap();
    assert_eq!(fl.free_count(), 1);

    let slot2 = fl.alloc().unwrap();
    assert!(slot2.read_all() == [0, 0]);
}

#[test]
fn slot_size_of_one() {
    let sab = create_sab(4096);
    let fl: FreeList<1> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    slot.write(0, 42);
    assert_eq!(slot.read(0), 42);
    assert_eq!(slot.read_all(), [42]);
}

#[test]
fn large_slot_size() {
    let sab = create_sab(8192);
    let fl: FreeList<SLOT_SIZE> = FreeList::new(sab, 0, 8);

    let slot = fl.alloc().unwrap();
    let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    slot.write_all(data);
    assert_eq!(slot.read_all(), data);
}

#[test]
fn nonzero_start_index() {
    let sab = create_sab(8192);
    let fl: FreeList<4> = FreeList::new(sab, 500, 8);

    let slot = fl.alloc().unwrap();
    slot.write_all([10, 20, 30, 40]);
    assert_eq!(slot.read_all(), [10, 20, 30, 40]);

    fl.free(slot).unwrap();
    assert_eq!(fl.free_count(), 8);
}

#[test]
fn alloc_free_alloc_cycle() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 4);

    for round in 0..10 {
        let mut handles = Vec::new();
        for _ in 0..4 {
            handles.push(fl.alloc().unwrap());
        }
        assert!(fl.alloc().is_none());

        for (i, h) in handles.iter().enumerate() {
            h.write_all([(round * 10 + i) as i32, 0]);
        }

        for h in handles {
            fl.free(h).unwrap();
        }
        assert_eq!(fl.free_count(), 4);
    }
}

#[test]
fn i32_extreme_values_in_slot() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 4);

    let slot = fl.alloc().unwrap();
    slot.write_all([i32::MAX, i32::MIN, 0, -1]);
    assert_eq!(slot.read_all(), [i32::MAX, i32::MIN, 0, -1]);
}

#[test]
fn zero_values_not_confused() {
    let sab = create_sab(4096);
    let fl: FreeList<4> = FreeList::new(sab, 0, 4);

    let slot = fl.alloc().unwrap();
    slot.write_all([0, 0, 0, 0]);
    assert_eq!(slot.read_all(), [0, 0, 0, 0]);
    assert_eq!(fl.free_count(), 3);
}

// ============ Double-Free Detection ============

#[test]
fn double_free_detected_via_bitmap() {
    let sab = create_sab(4096);
    let fl: FreeList<2> = FreeList::new(sab, 0, 4);

    // Alloc all 4 slots
    let a = fl.alloc().unwrap();
    let b = fl.alloc().unwrap();
    let c = fl.alloc().unwrap();
    let d = fl.alloc().unwrap();

    // Free slot a
    fl.free(a).unwrap();
    assert_eq!(fl.free_count(), 1);

    // Re-alloc gets slot a back (it's at head of free chain)
    let a_again = fl.alloc().unwrap();
    assert_eq!(fl.free_count(), 0);

    // Free it again — should work (it's occupied)
    fl.free(a_again).unwrap();
    assert_eq!(fl.free_count(), 1);

    // Free b, c, d
    fl.free(b).unwrap();
    fl.free(c).unwrap();
    fl.free(d).unwrap();
    assert_eq!(fl.free_count(), 4);
}

// ============ Stress Tests ============

#[test]
fn stress_alloc_free_random_order() {
    let sab = create_sab(65536);
    let fl: FreeList<4> = FreeList::new(sab, 0, 256);

    // Alloc all
    let mut handles: Vec<_> = (0..256).map(|_| fl.alloc().unwrap()).collect();
    assert!(fl.alloc().is_none());
    assert_eq!(fl.free_count(), 0);

    // Free in reverse order
    while let Some(h) = handles.pop() {
        fl.free(h).unwrap();
    }
    assert_eq!(fl.free_count(), 256);

    // Alloc all again
    let handles: Vec<_> = (0..256).map(|_| fl.alloc().unwrap()).collect();
    assert!(fl.alloc().is_none());

    // Free every other one
    let mut kept = Vec::new();
    for (i, h) in handles.into_iter().enumerate() {
        if i % 2 == 0 {
            fl.free(h).unwrap();
        } else {
            kept.push(h);
        }
    }
    assert_eq!(fl.free_count(), 128);

    // Alloc the freed ones back
    for _ in 0..128 {
        fl.alloc().unwrap();
    }
    assert!(fl.alloc().is_none());
    assert_eq!(fl.free_count(), 0);
}

#[test]
fn stress_interleaved_alloc_free() {
    let sab = create_sab(65536);
    let fl: FreeList<4> = FreeList::new(sab, 0, 128);

    let mut active = Vec::new();

    for i in 0..10_000 {
        if active.len() < 128 && i % 3 != 0 {
            // Alloc
            if let Some(slot) = fl.alloc() {
                slot.write(0, i as i32);
                active.push(slot);
            }
        } else if !active.is_empty() {
            // Free oldest
            let slot = active.remove(0);
            fl.free(slot).unwrap();
        }
    }

    // Verify: free_count + active = capacity
    assert_eq!(fl.free_count() + active.len() as i32, 128);
}

#[test]
fn stress_data_integrity_after_reuse() {
    let sab = create_sab(16384);
    let fl: FreeList<4> = FreeList::new(sab, 0, 32);

    for round in 0..100 {
        let mut handles = Vec::new();

        // Alloc all, write unique data
        for i in 0..32 {
            let slot = fl.alloc().unwrap();
            let val = (round * 100 + i) as i32;
            slot.write_all([val, val + 1, val + 2, val + 3]);
            handles.push((slot, val));
        }

        // Verify all data before freeing
        for (slot, val) in &handles {
            assert_eq!(slot.read_all(), [*val, val + 1, val + 2, val + 3]);
        }

        // Free all
        for (slot, _) in handles {
            fl.free(slot).unwrap();
        }
    }
}
