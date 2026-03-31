use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::slot_reader::SlotReader;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const SAB_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const CAPACITY: i32 = 512;

fn bench_slot_reader(c: &mut Criterion) {
    let sab = create_sab(SAB_SIZE);
    let (mut writer, mut reader) = TripleBuffer::new(sab, TB_START, TB_BUF_CAP);

    // Populate slot 0 and slot 42 with data, then publish
    writer.write(0, 42);
    writer.write(1, 99);
    writer.write(16 * 42, 777);
    writer.publish();
    reader.swap();

    let sr: SlotReader<'_, 16> = SlotReader::new(&reader, 0, CAPACITY);

    c.bench_function("SlotReader/read_field", |b| {
        b.iter(|| {
            black_box(sr.read_field(black_box(0), black_box(0)));
        });
    });

    c.bench_function("SlotReader/get_view", |b| {
        b.iter(|| {
            let view = sr.get(black_box(0));
            black_box(view.read(0));
        });
    });

    c.bench_function("SlotReader/read_field_distant_slot", |b| {
        b.iter(|| {
            black_box(sr.read_field(black_box(42), black_box(0)));
        });
    });

    c.bench_function("SlotReader/sequential_scan_8_slots", |b| {
        b.iter(|| {
            for i in 0..8 {
                black_box(sr.read_field(black_box(i), 0));
            }
        });
    });
}

criterion_group!(benches, bench_slot_reader);
criterion_main!(benches);
