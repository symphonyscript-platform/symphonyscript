use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::sync::Arc;
use std::sync::atomic::{AtomicI32, Ordering};
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

fn bench_writer_publish(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    // Pre-write some data
    let base = writer.current_start_index();
    for i in 0..buffer_size {
        mem[base + i].store(i as i32, Ordering::Relaxed);
    }

    c.bench_function("TripleBuffer/publish_64", |b| {
        b.iter(|| {
            black_box(writer.publish());
        });
    });
}

fn bench_reader_swap_with_data(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    c.bench_function("TripleBuffer/reader_swap_with_data", |b| {
        b.iter(|| {
            writer.publish();
            black_box(reader.swap());
        });
    });
}

fn bench_reader_swap_no_data(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (_writer, mut reader) = TripleBuffer::new(mem, 0, buffer_size);

    c.bench_function("TripleBuffer/reader_swap_no_data", |b| {
        b.iter(|| {
            black_box(reader.swap());
        });
    });
}

fn bench_publish_varying_buffer_size(c: &mut Criterion) {
    let mut group = c.benchmark_group("TripleBuffer/publish_by_size");

    for &size in &[8, 64, 256, 1024, 4096, 26000] {
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            let mem = create_mem(4 + size * 3 + 100);
            let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, size);

            // Fill the writer buffer
            let base = writer.current_start_index();
            for i in 0..size {
                mem[base + i].store(i as i32, Ordering::Relaxed);
            }

            b.iter(|| {
                black_box(writer.publish());
            });
        });
    }

    group.finish();
}

fn bench_full_cycle(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, mut reader) = TripleBuffer::new(mem.clone(), 0, buffer_size);

    c.bench_function("TripleBuffer/full_cycle_64", |b| {
        b.iter(|| {
            // Simulate real usage: write → publish → reader swap → read
            let base = writer.current_start_index();
            mem[base].store(42, Ordering::Relaxed);
            writer.publish();

            reader.swap();
            let rbase = reader.current_start_index();
            black_box(mem[rbase].load(Ordering::Relaxed));
        });
    });
}

fn bench_write_then_publish(c: &mut Criterion) {
    let mut group = c.benchmark_group("TripleBuffer/write+publish");

    for &size in &[8, 64, 256, 1024, 4096, 26000] {
        group.bench_with_input(BenchmarkId::from_parameter(size), &size, |b, &size| {
            let mem = create_mem(4 + size * 3 + 100);
            let (mut writer, _reader) = TripleBuffer::new(mem.clone(), 0, size);

            b.iter(|| {
                let base = writer.current_start_index();
                for i in 0..size {
                    mem[base + i].store(i as i32, Ordering::Relaxed);
                }
                black_box(writer.publish());
            });
        });
    }

    group.finish();
}

fn bench_rapid_publish_no_reader(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, _reader) = TripleBuffer::new(mem, 0, buffer_size);

    c.bench_function("TripleBuffer/rapid_publish_no_reader", |b| {
        b.iter(|| {
            for _ in 0..10 {
                black_box(writer.publish());
            }
        });
    });
}

fn bench_reader_swap_after_many_publishes(c: &mut Criterion) {
    let buffer_size = 64;
    let mem = create_mem(4 + buffer_size * 3 + 100);
    let (mut writer, mut reader) = TripleBuffer::new(mem, 0, buffer_size);

    c.bench_function("TripleBuffer/swap_after_10_publishes", |b| {
        b.iter(|| {
            for _ in 0..10 {
                writer.publish();
            }
            black_box(reader.swap());
        });
    });
}

criterion_group!(
    benches,
    bench_writer_publish,
    bench_reader_swap_with_data,
    bench_reader_swap_no_data,
    bench_publish_varying_buffer_size,
    bench_full_cycle,
    bench_write_then_publish,
    bench_rapid_publish_no_reader,
    bench_reader_swap_after_many_publishes,
);
criterion_main!(benches);
