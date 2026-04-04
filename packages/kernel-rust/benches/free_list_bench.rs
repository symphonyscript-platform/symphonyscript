use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::AtomicBuffer;
use symphonyscript_kernel::primitives::free_list::FreeList;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn bench_alloc(c: &mut Criterion) {
    let mut group = c.benchmark_group("FreeList/alloc");

    for &slot_size_label in &[1, 4, 16] {
        match slot_size_label {
            1 => {
                let mem = create_mem(1_000_000);
                let fl: FreeList<1> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 1), |b| {
                    b.iter(|| black_box(fl.alloc()));
                });
            }
            4 => {
                let mem = create_mem(1_000_000);
                let fl: FreeList<4> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 4), |b| {
                    b.iter(|| black_box(fl.alloc()));
                });
            }
            16 => {
                let mem = create_mem(4_000_000);
                let fl: FreeList<16> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 16), |b| {
                    b.iter(|| black_box(fl.alloc()));
                });
            }
            _ => {}
        }
    }

    group.finish();
}

fn bench_alloc_free_cycle(c: &mut Criterion) {
    let mut group = c.benchmark_group("FreeList/alloc_free_cycle");

    for &slot_size_label in &[1, 4, 16] {
        match slot_size_label {
            1 => {
                let mem = create_mem(1_000_000);
                let fl: FreeList<1> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 1), |b| {
                    b.iter(|| {
                        let slot = fl.alloc().unwrap();
                        black_box(fl.free(slot));
                    });
                });
            }
            4 => {
                let mem = create_mem(1_000_000);
                let fl: FreeList<4> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 4), |b| {
                    b.iter(|| {
                        let slot = fl.alloc().unwrap();
                        black_box(fl.free(slot));
                    });
                });
            }
            16 => {
                let mem = create_mem(4_000_000);
                let fl: FreeList<16> = FreeList::new(mem, 0, 131072);
                group.bench_function(BenchmarkId::new("SLOT_SIZE", 16), |b| {
                    b.iter(|| {
                        let slot = fl.alloc().unwrap();
                        black_box(fl.free(slot));
                    });
                });
            }
            _ => {}
        }
    }

    group.finish();
}

fn bench_alloc_write_free(c: &mut Criterion) {
    let mem = create_mem(1_000_000);
    let fl: FreeList<4> = FreeList::new(mem, 0, 131072);

    c.bench_function("FreeList/alloc+write+free", |b| {
        b.iter(|| {
            let slot = fl.alloc().unwrap();
            slot.write_all(black_box([1, 2, 3, 4]));
            black_box(fl.free(slot));
        });
    });
}

fn bench_batch_alloc(c: &mut Criterion) {
    let mut group = c.benchmark_group("FreeList/batch_alloc");

    for &batch in &[10, 100, 1_000] {
        group.bench_with_input(BenchmarkId::from_parameter(batch), &batch, |b, &batch| {
            b.iter_with_setup(
                || {
                    let mem = create_mem(1_000_000);
                    FreeList::<4>::new(mem, 0, 16384)
                },
                |fl| {
                    for _ in 0..batch {
                        black_box(fl.alloc().unwrap());
                    }
                },
            );
        });
    }

    group.finish();
}

fn bench_batch_free(c: &mut Criterion) {
    let mut group = c.benchmark_group("FreeList/batch_free");

    for &batch in &[10, 100, 1_000] {
        group.bench_with_input(BenchmarkId::from_parameter(batch), &batch, |b, &batch| {
            b.iter_custom(|iters| {
                let mem = create_mem(1_000_000);
                let fl = FreeList::<4>::new(mem, 0, 16384);
                let mut total = std::time::Duration::ZERO;
                for _ in 0..iters {
                    let handles: Vec<_> = (0..batch).map(|_| fl.alloc().unwrap()).collect();
                    let start = std::time::Instant::now();
                    for h in handles {
                        black_box(fl.free(h).unwrap());
                    }
                    total += start.elapsed();
                }
                total
            });
        });
    }

    group.finish();
}

fn bench_alloc_empty(c: &mut Criterion) {
    let mem = create_mem(4096);
    let fl: FreeList<4> = FreeList::new(mem, 0, 4);

    // Exhaust the free list
    let _a = fl.alloc().unwrap();
    let _b = fl.alloc().unwrap();
    let _c = fl.alloc().unwrap();
    let _d = fl.alloc().unwrap();

    c.bench_function("FreeList/alloc_exhausted", |b| {
        b.iter(|| black_box(fl.alloc()));
    });
}

fn bench_slot_read_write(c: &mut Criterion) {
    let mem = create_mem(1_000_000);
    let fl: FreeList<4> = FreeList::new(mem, 0, 131072);
    let slot = fl.alloc().unwrap();

    c.bench_function("SlotHandle/write+read (SLOT_SIZE=4)", |b| {
        b.iter(|| {
            slot.write_all(black_box([1, 2, 3, 4]));
            black_box(slot.read_all());
        });
    });
}

criterion_group!(
    benches,
    bench_alloc,
    bench_alloc_free_cycle,
    bench_alloc_write_free,
    bench_batch_alloc,
    bench_batch_free,
    bench_alloc_empty,
    bench_slot_read_write,
);
criterion_main!(benches);
