use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use synaptic_kernel::attributes::attribute_plane_writer::AttributePlaneWriter;
use synaptic_kernel::attributes::attributes_writer::AttributesWriter;
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::primitives::types::AtomicBuffer;

const SLOT: usize = 16;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

/// Layout matches former note-style slots (indices 0–9 used).
#[derive(Clone)]
struct BenchAttrs {
    pitch: i32,
    velocity: i32,
    duration: i32,
    volume: i32,
    spatial_x: i32,
    spatial_y: i32,
    spatial_z: i32,
    detune: i32,
    tick_offset: i32,
    flags: i32,
}

impl IntoArray<SLOT> for BenchAttrs {
    fn to_array(&self) -> [i32; SLOT] {
        let mut a = [0i32; SLOT];
        a[0] = self.pitch;
        a[1] = self.velocity;
        a[2] = self.duration;
        a[3] = self.volume;
        a[4] = self.spatial_x;
        a[5] = self.spatial_y;
        a[6] = self.spatial_z;
        a[7] = self.detune;
        a[8] = self.tick_offset;
        a[9] = self.flags;
        a
    }
}

fn sample_data() -> BenchAttrs {
    BenchAttrs {
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

// ============ AttributesWriter (raw slot) ============

fn bench_view_read_single_field(c: &mut Criterion) {
    let mem = create_mem(1024);
    let view: AttributesWriter<'_, SLOT> = AttributesWriter::new(&mem, 0);
    view.write(0, 570000);

    c.bench_function("AttributesWriter/read_word0", |b| {
        b.iter(|| black_box(view.read(0)));
    });
}

fn bench_view_write_single_field(c: &mut Criterion) {
    let mem = create_mem(1024);
    let view: AttributesWriter<'_, SLOT> = AttributesWriter::new(&mem, 0);

    c.bench_function("AttributesWriter/write_word0", |b| {
        b.iter(|| view.write(0, black_box(570000)));
    });
}

fn bench_view_read_all_fields(c: &mut Criterion) {
    let mem = create_mem(1024);
    let view: AttributesWriter<'_, SLOT> = AttributesWriter::new(&mem, 0);
    view.write(0, 570000);
    view.write(1, 100);
    view.write(2, 480);
    view.write(3, 800);
    view.write(4, -500);
    view.write(5, 200);
    view.write(6, 0);
    view.write(7, 50);
    view.write(8, -10);
    view.write(9, 0b11);

    c.bench_function("AttributesWriter/read_all_10_words", |b| {
        b.iter(|| {
            for i in 0..10 {
                black_box(view.read(i));
            }
        });
    });
}

fn bench_view_write_all_fields(c: &mut Criterion) {
    let mem = create_mem(1024);
    let view: AttributesWriter<'_, SLOT> = AttributesWriter::new(&mem, 0);

    c.bench_function("AttributesWriter/write_all_10_words", |b| {
        b.iter(|| {
            view.write(0, black_box(570000));
            view.write(1, black_box(100));
            view.write(2, black_box(480));
            view.write(3, black_box(800));
            view.write(4, black_box(-500));
            view.write(5, black_box(200));
            view.write(6, black_box(0));
            view.write(7, black_box(50));
            view.write(8, black_box(-10));
            view.write(9, black_box(0b11));
        });
    });
}

fn bench_view_flags_mask(c: &mut Criterion) {
    let mem = create_mem(1024);
    let view: AttributesWriter<'_, SLOT> = AttributesWriter::new(&mem, 0);
    view.write(9, 0b11);

    c.bench_function("AttributesWriter/flags_mask_read", |b| {
        b.iter(|| {
            let f = view.read(9);
            black_box(f & 1);
            black_box(f & 2);
        });
    });
}

// ============ AttributePlaneWriter ============

fn bench_plane_set(c: &mut Criterion) {
    let mem = create_mem(65538);
    let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, 4096);

    c.bench_function("AttributePlane/set", |b| {
        b.iter(|| {
            plane.set(black_box(1), sample_data());
        });
    });
}

fn bench_plane_get(c: &mut Criterion) {
    let mem = create_mem(65538);
    let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, 4096);
    plane.set(1, sample_data());

    c.bench_function("AttributePlane/get_read_word0", |b| {
        b.iter(|| {
            let w = plane.get(black_box(1));
            black_box(w.read(0));
        });
    });
}

fn bench_plane_set_get_cycle(c: &mut Criterion) {
    let mem = create_mem(65538);
    let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, 4096);

    c.bench_function("AttributePlane/set+get_cycle", |b| {
        b.iter(|| {
            plane.set(black_box(42), sample_data());
            let w = plane.get(black_box(42));
            black_box(w.read(0));
        });
    });
}

fn bench_plane_sequential_read(c: &mut Criterion) {
    let mut group = c.benchmark_group("AttributePlane/sequential_read");

    for &count in &[32, 128, 512, 2048] {
        let mem_size = count * SLOT + 1;
        let mem = create_mem(mem_size);
        let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, count);

        for i in 0..count {
            plane.set(
                i + 1,
                BenchAttrs {
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
                },
            );
        }

        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
            b.iter(|| {
                for i in 0..count {
                    let w = plane.get(i + 1);
                    black_box(w.read(0));
                    black_box(w.read(1));
                }
            });
        });
    }

    group.finish();
}

fn bench_plane_sequential_write(c: &mut Criterion) {
    let mut group = c.benchmark_group("AttributePlane/sequential_write");

    for &count in &[32, 128, 512, 2048] {
        let mem_size = count * SLOT + 1;
        let mem = create_mem(mem_size);
        let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, count);

        group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &count| {
            b.iter(|| {
                for i in 0..count {
                    plane.set(i + 1, sample_data());
                }
            });
        });
    }

    group.finish();
}

fn bench_plane_random_access(c: &mut Criterion) {
    let capacity = 4096;
    let mem_size = capacity * SLOT + 1;
    let mem = create_mem(mem_size);
    let plane = AttributePlaneWriter::<SLOT>::new(mem, 0, capacity);

    for i in 0..capacity {
        plane.set(i + 1, sample_data());
    }

    let indices: Vec<usize> = (0..1000)
        .map(|i| 1 + ((i * 2654435761) % capacity))
        .collect();

    c.bench_function("AttributePlane/random_access_1000", |b| {
        b.iter(|| {
            for &idx in &indices {
                let w = plane.get(idx);
                black_box(w.read(0));
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
    bench_view_flags_mask,
    bench_plane_set,
    bench_plane_get,
    bench_plane_set_get_cycle,
    bench_plane_sequential_read,
    bench_plane_sequential_write,
    bench_plane_random_access,
);
criterion_main!(benches);
