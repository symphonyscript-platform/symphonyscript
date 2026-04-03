use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attribute_plane::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::attribute_plane::writer::note_attributes_writer::{NoteAttributes, NoteAttributesWriter};

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn sample_data() -> NoteAttributes {
    NoteAttributes {
        pitch: 570000,
        velocity: 100,
        duration: 480,
        volume: 800,
        spatial_x: -500,
        spatial_y: 200,
        spatial_z: 0,
        detune: 50,
        tick_offset: -10,
        flags: 0,
    }
}

// ============ NodeAttributesView Benchmarks ============

fn bench_view_read_single_field(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_pitch(570000);

    c.bench_function("NodeAttributesView/read_pitch", |b| {
        b.iter(|| black_box(view.pitch()));
    });
}

fn bench_view_write_single_field(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    c.bench_function("NodeAttributesView/write_pitch", |b| {
        b.iter(|| view.set_pitch(black_box(570000)));
    });
}

fn bench_view_read_all_fields(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_pitch(570000);
    view.set_velocity(100);
    view.set_duration(480);
    view.set_volume(800);
    view.set_spatial_x(-500);
    view.set_spatial_y(200);
    view.set_spatial_z(0);
    view.set_detune(50);
    view.set_tick_offset(-10);
    view.set_flags(0b11);

    c.bench_function("NodeAttributesView/read_all_10_fields", |b| {
        b.iter(|| {
            black_box(view.pitch());
            black_box(view.velocity());
            black_box(view.duration());
            black_box(view.volume());
            black_box(view.spatial_x());
            black_box(view.spatial_y());
            black_box(view.spatial_z());
            black_box(view.detune());
            black_box(view.tick_offset());
            black_box(view.flags());
        });
    });
}

fn bench_view_write_all_fields(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));

    c.bench_function("NodeAttributesView/write_all_10_fields", |b| {
        b.iter(|| {
            view.set_pitch(black_box(570000));
            view.set_velocity(black_box(100));
            view.set_duration(black_box(480));
            view.set_volume(black_box(800));
            view.set_spatial_x(black_box(-500));
            view.set_spatial_y(black_box(200));
            view.set_spatial_z(black_box(0));
            view.set_detune(black_box(50));
            view.set_tick_offset(black_box(-10));
            view.set_flags(black_box(0b11));
        });
    });
}

fn bench_view_flags_check(c: &mut Criterion) {
    let sab = create_sab(1024);
    let view = NoteAttributesWriter(AttributesWriter::new(&sab, 0));
    view.set_flags(0b11);

    c.bench_function("NodeAttributesView/is_muted+is_solo", |b| {
        b.iter(|| {
            black_box(view.is_muted());
            black_box(view.is_solo());
        });
    });
}

// ============ AttributePlane Benchmarks ============

fn bench_plane_set(c: &mut Criterion) {
    let sab = create_sab(65538);
    let plane = AttributePlaneWriter::<16>::new(sab, 0, 4096);

    c.bench_function("AttributePlane/set", |b| {
        b.iter(|| {
            plane.set(black_box(0), sample_data());
        });
    });
}

fn bench_plane_get(c: &mut Criterion) {
    let sab = create_sab(65538);
    let plane = AttributePlaneWriter::<16>::new(sab, 0, 4096);
    plane.set(0, sample_data());

    c.bench_function("AttributePlane/get", |b| {
        b.iter(|| {
            let view = NoteAttributesWriter(plane.get(black_box(0)));
            black_box(view.pitch());
        });
    });
}

fn bench_plane_set_get_cycle(c: &mut Criterion) {
    let sab = create_sab(65538);
    let plane = AttributePlaneWriter::<16>::new(sab, 0, 4096);

    c.bench_function("AttributePlane/set+get_cycle", |b| {
        b.iter(|| {
            plane.set(black_box(42), sample_data());
            let view = NoteAttributesWriter(plane.get(black_box(42)));
            black_box(view.pitch());
        });
    });
}

fn bench_plane_sequential_read(c: &mut Criterion) {
    let mut group = c.benchmark_group("AttributePlane/sequential_read");

    for &count in &[32, 128, 512, 2048] {
        let sab_size = count * 16 + 1;
        let sab = create_sab(sab_size);
        let plane = AttributePlaneWriter::<16>::new(sab, 0, count);

        for i in 0..count {
            plane.set(i, NoteAttributes {
                pitch: i as i32 * 1000,
                velocity: i as i32,
                duration: 480,
                volume: 800,
                spatial_x: 0,
                spatial_y: 0,
                spatial_z: 0,
                detune: 0,
                tick_offset: 0,
                flags: 0,
            });
        }

        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
            b.iter(|| {
                for i in 0..count {
                    let view = NoteAttributesWriter(plane.get(i));
                    black_box(view.pitch());
                    black_box(view.velocity());
                }
            });
        });
    }

    group.finish();
}

fn bench_plane_sequential_write(c: &mut Criterion) {
    let mut group = c.benchmark_group("AttributePlane/sequential_write");

    for &count in &[32, 128, 512, 2048] {
        let sab_size = count * 16 + 1;
        let sab = create_sab(sab_size);
        let plane = AttributePlaneWriter::<16>::new(sab, 0, count);

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
    let sab_size = capacity * 16 + 1;
    let sab = create_sab(sab_size);
    let plane = AttributePlaneWriter::<16>::new(sab, 0, capacity);

    for i in 0..capacity {
        plane.set(i, sample_data());
    }

    // Pre-compute pseudo-random access pattern
    let indices: Vec<usize> = (0..1000).map(|i| (i * 2654435761) % capacity).collect();

    c.bench_function("AttributePlane/random_access_1000", |b| {
        b.iter(|| {
            for &idx in &indices {
                let view = NoteAttributesWriter(plane.get(idx));
                black_box(view.pitch());
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
    bench_view_flags_check,
    bench_plane_set,
    bench_plane_get,
    bench_plane_set_get_cycle,
    bench_plane_sequential_read,
    bench_plane_sequential_write,
    bench_plane_random_access,
);
criterion_main!(benches);
