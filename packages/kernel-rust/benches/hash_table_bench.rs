use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::hash_table::probe_hash_table::ProbeHashTable;
use symphonyscript_kernel::primitives::hash_table::hash_table_trait::HashTable;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn fibonacci_hash(key: i32, shift: u32) -> usize {
    let fib: u32 = 2654435769;
    ((key as u32).wrapping_mul(fib) >> shift) as usize
}

fn bench_set_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("HashTable/set_insert");

    for &size in &[100, 1_000, 10_000, 50_000] {
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            b.iter_with_setup(
                || {
                    let sab = create_sab(1_000_000);
                    ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash)
                },
                |table| {
                    for i in 0..size {
                        black_box(table.set(i, i * 10).unwrap());
                    }
                },
            );
        });
    }

    group.finish();
}

fn bench_get_hit(c: &mut Criterion) {
    let mut group = c.benchmark_group("HashTable/get_hit");

    for &size in &[100, 1_000, 10_000, 50_000] {
        let sab = create_sab(1_000_000);
        let table = ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash);
        for i in 0..size {
            table.set(i, i * 10).unwrap();
        }

        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            b.iter(|| {
                for i in 0..size {
                    black_box(table.get(i));
                }
            });
        });
    }

    group.finish();
}

fn bench_get_miss(c: &mut Criterion) {
    let mut group = c.benchmark_group("HashTable/get_miss");

    for &size in &[100, 1_000, 10_000] {
        let sab = create_sab(1_000_000);
        let table = ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash);
        for i in 0..size {
            table.set(i, i * 10).unwrap();
        }

        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            b.iter(|| {
                for i in size..(size * 2) {
                    black_box(table.get(i));
                }
            });
        });
    }

    group.finish();
}

fn bench_overwrite(c: &mut Criterion) {
    let sab = create_sab(1_000_000);
    let table = ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash);
    for i in 0..10_000 {
        table.set(i, i * 10).unwrap();
    }

    c.bench_function("HashTable/overwrite_10k", |b| {
        b.iter(|| {
            for i in 0..10_000 {
                black_box(table.set(i, i * 20).unwrap());
            }
        });
    });
}

fn bench_delete(c: &mut Criterion) {
    c.bench_function("HashTable/delete_10k", |b| {
        b.iter_with_setup(
            || {
                let sab = create_sab(1_000_000);
                let table = ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash);
                for i in 0..10_000 {
                    table.set(i, i * 10).unwrap();
                }
                table
            },
            |table| {
                for i in 0..10_000 {
                    black_box(table.delete(i));
                }
            },
        );
    });
}

fn bench_mixed_workload(c: &mut Criterion) {
    c.bench_function("HashTable/mixed_workload", |b| {
        b.iter_with_setup(
            || {
                let sab = create_sab(1_000_000);
                ProbeHashTable::new(sab, 0, 131072, 0.75, fibonacci_hash)
            },
            |table| {
                // Insert 1000
                for i in 0..1_000 {
                    table.set(i, i).unwrap();
                }
                // Read 1000
                for i in 0..1_000 {
                    black_box(table.get(i));
                }
                // Overwrite 500
                for i in 0..500 {
                    table.set(i, i * 2).unwrap();
                }
                // Delete 500
                for i in 0..500 {
                    black_box(table.delete(i));
                }
                // Read remaining
                for i in 500..1_000 {
                    black_box(table.get(i));
                }
            },
        );
    });
}

criterion_group!(
    benches,
    bench_set_insert,
    bench_get_hit,
    bench_get_miss,
    bench_overwrite,
    bench_delete,
    bench_mixed_workload,
);
criterion_main!(benches);
