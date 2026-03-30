use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::synapse_attribute_plane::SynapseAttributePlane;
use symphonyscript_kernel::synapse_attributes::{SynapseAttributesData, SynapseAttributesView};

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn sample_data() -> SynapseAttributesData {
    SynapseAttributesData {
        weight: 850,
        tick_offset: -10,
        transpose: 700,
        volume_scale: 500,
    }
}

// ============ SynapseAttributesView Benchmarks ============

fn bench_view_read_single_field(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_weight(850);

    c.bench_function("SynapseAttributesView/read_weight", |b| {
        b.iter(|| black_box(view.weight()));
    });
}

fn bench_view_write_single_field(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = SynapseAttributesView::new(&sab, 0);

    c.bench_function("SynapseAttributesView/write_weight", |b| {
        b.iter(|| view.set_weight(black_box(850)));
    });
}

fn bench_view_read_all_fields(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = SynapseAttributesView::new(&sab, 0);
    view.set_weight(850);
    view.set_tick_offset(-10);
    view.set_transpose(700);
    view.set_volume_scale(500);

    c.bench_function("SynapseAttributesView/read_all_4_fields", |b| {
        b.iter(|| {
            black_box(view.weight());
            black_box(view.tick_offset());
            black_box(view.transpose());
            black_box(view.volume_scale());
        });
    });
}

fn bench_view_write_all_fields(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = SynapseAttributesView::new(&sab, 0);

    c.bench_function("SynapseAttributesView/write_all_4_fields", |b| {
        b.iter(|| {
            view.set_weight(black_box(850));
            view.set_tick_offset(black_box(-10));
            view.set_transpose(black_box(700));
            view.set_volume_scale(black_box(500));
        });
    });
}

// ============ SynapseAttributePlane Benchmarks ============

fn bench_plane_set(c: &mut Criterion) {
    let sab = create_sab(65536);
    let plane = SynapseAttributePlane::new(sab, 0, 4096);

    c.bench_function("SynapseAttributePlane/set", |b| {
        b.iter(|| {
            plane.set(black_box(0), sample_data());
        });
    });
}

fn bench_plane_get(c: &mut Criterion) {
    let sab = create_sab(65536);
    let plane = SynapseAttributePlane::new(sab, 0, 4096);
    plane.set(0, sample_data());

    c.bench_function("SynapseAttributePlane/get", |b| {
        b.iter(|| {
            let view = plane.get(black_box(0));
            black_box(view.weight());
        });
    });
}

fn bench_plane_set_get_cycle(c: &mut Criterion) {
    let sab = create_sab(65536);
    let plane = SynapseAttributePlane::new(sab, 0, 4096);

    c.bench_function("SynapseAttributePlane/set+get_cycle", |b| {
        b.iter(|| {
            plane.set(black_box(42), sample_data());
            let view = plane.get(black_box(42));
            black_box(view.weight());
        });
    });
}

fn bench_plane_sequential_read(c: &mut Criterion) {
    let mut group = c.benchmark_group("SynapseAttributePlane/sequential_read");

    for &count in &[32, 128, 512, 2048] {
        let sab_size = count * SynapseAttributesView::SLOT_SIZE + 1;
        let sab = create_sab(sab_size);
        let plane = SynapseAttributePlane::new(sab, 0, count);

        for i in 0..count {
            plane.set(i, SynapseAttributesData {
                weight: i as i32 * 2,
                tick_offset: -(i as i32),
                transpose: i as i32 * 100,
                volume_scale: 1000,
            });
        }

        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
            b.iter(|| {
                for i in 0..count {
                    let view = plane.get(i);
                    black_box(view.weight());
                    black_box(view.transpose());
                }
            });
        });
    }

    group.finish();
}

fn bench_plane_sequential_write(c: &mut Criterion) {
    let mut group = c.benchmark_group("SynapseAttributePlane/sequential_write");

    for &count in &[32, 128, 512, 2048] {
        let sab_size = count * SynapseAttributesView::SLOT_SIZE + 1;
        let sab = create_sab(sab_size);
        let plane = SynapseAttributePlane::new(sab, 0, count);

        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
            b.iter(|| {
                for i in 0..count {
                    plane.set(i, sample_data());
                }
            });
        });
    }

    group.finish();
}

fn bench_plane_random_access(c: &mut Criterion) {
    let capacity = 4096;
    let sab_size = capacity * SynapseAttributesView::SLOT_SIZE + 1;
    let sab = create_sab(sab_size);
    let plane = SynapseAttributePlane::new(sab, 0, capacity);

    for i in 0..capacity {
        plane.set(i, sample_data());
    }

    let indices: Vec<usize> = (0..1000).map(|i| (i * 2654435761) % capacity).collect();

    c.bench_function("SynapseAttributePlane/random_access_1000", |b| {
        b.iter(|| {
            for &idx in &indices {
                let view = plane.get(idx);
                black_box(view.weight());
            }
        });
    });
}

criterion_group!(
    benches,
    bench_view_read_single_field,
    bench_view_write_single_field,
    bench_view_read_all_fields,
    bench_view_write_all_fields,
    bench_plane_set,
    bench_plane_get,
    bench_plane_set_get_cycle,
    bench_plane_sequential_read,
    bench_plane_sequential_write,
    bench_plane_random_access,
);
criterion_main!(benches);
