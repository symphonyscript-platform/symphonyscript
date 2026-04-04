use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::AtomicBuffer;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn bench_alloc(c: &mut Criterion) {
    let mem = create_mem(1_000_000);
    let fl = SimpleFreeList::new(mem, 0, 131072);

    c.bench_function("SimpleFreeList/alloc", |b| {
        b.iter(|| black_box(fl.alloc()));
    });
}

fn bench_alloc_free_cycle(c: &mut Criterion) {
    let mem = create_mem(1_000_000);
    let fl = SimpleFreeList::new(mem, 0, 131072);

    c.bench_function("SimpleFreeList/alloc+free_cycle", |b| {
        b.iter(|| {
            let slot = fl.alloc().unwrap();
            black_box(fl.free(slot).unwrap());
        });
    });
}

fn bench_alloc_exhausted(c: &mut Criterion) {
    let mem = create_mem(4096);
    let fl = SimpleFreeList::new(mem, 0, 4);

    // Exhaust the free list
    for _ in 0..4 {
        fl.alloc().unwrap();
    }

    c.bench_function("SimpleFreeList/alloc_exhausted", |b| {
        b.iter(|| black_box(fl.alloc()));
    });
}

fn bench_batch_alloc(c: &mut Criterion) {
    let mut group = c.benchmark_group("SimpleFreeList/batch_alloc");

    for &batch in &[10, 100, 1_000] {
        group.bench_with_input(BenchmarkId::from_parameter(batch), &batch, |b, &batch| {
            b.iter_with_setup(
                || {
                    let mem = create_mem(1_000_000);
                    SimpleFreeList::new(mem, 0, 16384)
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
    let mut group = c.benchmark_group("SimpleFreeList/batch_free");

    for &batch in &[10, 100, 1_000] {
        group.bench_with_input(BenchmarkId::from_parameter(batch), &batch, |b, &batch| {
            b.iter_with_setup(
                || {
                    let mem = create_mem(1_000_000);
                    let fl = SimpleFreeList::new(mem, 0, 16384);
                    let slots: Vec<usize> = (0..batch).map(|_| fl.alloc().unwrap()).collect();
                    (fl, slots)
                },
                |(fl, slots)| {
                    for s in slots {
                        black_box(fl.free(s).unwrap());
                    }
                },
            );
        });
    }

    group.finish();
}

fn bench_double_free_check(c: &mut Criterion) {
    let mem = create_mem(1_000_000);
    let fl = SimpleFreeList::new(mem, 0, 131072);

    // Alloc and free one slot — it's now free
    let slot = fl.alloc().unwrap();
    fl.free(slot).unwrap();

    // Benchmark the double-free detection path (bitmap check returns early)
    c.bench_function("SimpleFreeList/double_free_detect", |b| {
        b.iter(|| black_box(fl.free(slot)));
    });
}

fn bench_high_fragmentation(c: &mut Criterion) {
    c.bench_function("SimpleFreeList/fragmented_alloc_free", |b| {
        b.iter_with_setup(
            || {
                let mem = create_mem(1_000_000);
                let fl = SimpleFreeList::new(mem, 0, 4096);
                // Alloc all, free odd slots → 50% fragmented
                let slots: Vec<usize> = (0..4096).map(|_| fl.alloc().unwrap()).collect();
                for s in &slots {
                    if s % 2 == 1 {
                        fl.free(*s).unwrap();
                    }
                }
                fl
            },
            |fl| {
                // Alloc from fragmented list
                for _ in 0..100 {
                    let s = fl.alloc().unwrap();
                    black_box(s);
                    fl.free(s).unwrap();
                }
            },
        );
    });
}

fn bench_vs_old_freelist_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("Comparison/alloc+free");

    // SimpleFreeList
    group.bench_function("SimpleFreeList", |b| {
        let mem = create_mem(1_000_000);
        let fl = SimpleFreeList::new(mem, 0, 131072);
        b.iter(|| {
            let slot = fl.alloc().unwrap();
            black_box(fl.free(slot).unwrap());
        });
    });

    // Old FreeList<1> (closest to SimpleFreeList — minimal slot size)
    group.bench_function("FreeList<1>", |b| {
        use symphonyscript_kernel::primitives::free_list::FreeList;
        let mem = create_mem(1_000_000);
        let fl: FreeList<1> = FreeList::new(mem, 0, 131072);
        b.iter(|| {
            let slot = fl.alloc().unwrap();
            black_box(fl.free(slot).unwrap());
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_alloc,
    bench_alloc_free_cycle,
    bench_alloc_exhausted,
    bench_batch_alloc,
    bench_batch_free,
    bench_double_free_check,
    bench_high_fragmentation,
    bench_vs_old_freelist_comparison,
);
criterion_main!(benches);
