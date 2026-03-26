use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::hash_table::probe_hash_table::ProbeHashTable;
use symphonyscript_kernel::primitives::hash_table::hash_table_trait::HashTable;

/// Fibonacci hash function for testing.
fn fibonacci_hash(key: i32, shift: u32) -> usize {
    let fib: u32 = 2654435769;
    ((key as u32).wrapping_mul(fib) >> shift) as usize
}

/// Creates a SAB with the given number of AtomicI32 slots.
fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn get_returns_none_on_empty_table() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    assert_eq!(table.get(42), None);
    assert_eq!(table.get(0), None);
    assert_eq!(table.get(-1), None);
}

#[test]
fn set_and_get_single_entry() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    assert!(table.set(10, 100).is_ok());
    assert_eq!(table.get(10), Some(100));
}

#[test]
fn set_and_get_multiple_entries() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 16, 0.75, fibonacci_hash);

    for i in 1..=10 {
        assert!(table.set(i, i * 100).is_ok());
    }

    for i in 1..=10 {
        assert_eq!(table.get(i), Some(i * 100));
    }
}

#[test]
fn set_overwrites_existing_key() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    assert!(table.set(5, 50).is_ok());
    assert_eq!(table.get(5), Some(50));

    assert!(table.set(5, 999).is_ok());
    assert_eq!(table.get(5), Some(999));
}

#[test]
fn len_tracks_insertions() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    assert_eq!(table.len(), 0);

    table.set(1, 10).unwrap();
    assert_eq!(table.len(), 1);

    table.set(2, 20).unwrap();
    assert_eq!(table.len(), 2);

    // Overwrite should not increment len
    table.set(1, 99).unwrap();
    assert_eq!(table.len(), 2);
}

#[test]
fn delete_existing_key() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    table.set(7, 70).unwrap();
    assert_eq!(table.get(7), Some(70));
    assert_eq!(table.len(), 1);

    let deleted = table.delete(7);
    assert_eq!(deleted, Some(70));
    assert_eq!(table.get(7), None);
    assert_eq!(table.len(), 0);
}

#[test]
fn delete_nonexistent_key_returns_none() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    assert_eq!(table.delete(99), None);
}

#[test]
fn delete_with_backward_shift() {
    let sab = create_sab(4096);
    let table = ProbeHashTable::new(sab, 0, 16, 0.75, fibonacci_hash);

    // Insert several keys that may collide
    for i in 1..=8 {
        table.set(i, i * 10).unwrap();
    }

    // Delete a key from the middle
    table.delete(4);

    // All other keys should still be retrievable
    for i in 1..=8 {
        if i == 4 {
            assert_eq!(table.get(i), None);
        } else {
            assert_eq!(table.get(i), Some(i * 10));
        }
    }
}

#[test]
fn set_returns_full_when_table_is_full() {
    let sab = create_sab(4096);
    let table = ProbeHashTable::new(sab, 0, 4, 1.0, fibonacci_hash);
    // With max_load_factor 1.0, capacity = 4

    table.set(1, 10).unwrap();
    table.set(2, 20).unwrap();
    table.set(3, 30).unwrap();
    table.set(4, 40).unwrap();

    let result = table.set(5, 50);
    assert!(result.is_err());
}

#[test]
fn compute_capacity_is_power_of_two() {
    let cap = ProbeHashTable::compute_capacity(10, 0.75);
    assert!(cap.is_power_of_two());
    assert!(cap >= 14); // 10 / 0.75 = 13.33, ceil = 14, next_power_of_two = 16
}

#[test]
fn end_index_is_correct() {
    let sab = create_sab(4096);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    let cap = ProbeHashTable::compute_capacity(8, 0.75);
    // end_index = start(0) + 1(len header) + capacity * 3(slot size)
    let expected = 0 + 1 + cap * 3;
    assert_eq!(table.end_index(), expected);
}

#[test]
fn table_works_with_nonzero_start_index() {
    let sab = create_sab(4096);
    let start = 100;
    let table = ProbeHashTable::new(sab, start, 8, 0.75, fibonacci_hash);

    table.set(1, 10).unwrap();
    table.set(2, 20).unwrap();

    assert_eq!(table.get(1), Some(10));
    assert_eq!(table.get(2), Some(20));
    assert_eq!(table.len(), 2);
}

#[test]
fn negative_keys_work() {
    let sab = create_sab(1024);
    let table = ProbeHashTable::new(sab, 0, 8, 0.75, fibonacci_hash);

    table.set(-1, 100).unwrap();
    table.set(-100, 200).unwrap();

    assert_eq!(table.get(-1), Some(100));
    assert_eq!(table.get(-100), Some(200));
}
