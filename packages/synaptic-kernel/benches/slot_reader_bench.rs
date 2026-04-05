use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::topology::slot_reader::SlotReader;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const MEM_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const SLOT_STRIDE: usize = 16;

fn bench_slot_reader(c: &mut Criterion) {
    let mem = create_mem(MEM_SIZE);
    let (mut writer, mut reader) = TripleBuffer::new(mem, TB_START, TB_BUF_CAP);

    writer.write(0, 42);
    writer.write(1, 99);
    let off43 = (43 - 1) * SLOT_STRIDE;
    writer.write(off43, 777);
    writer.publish();
    reader.swap();

    let sr_slot1 = SlotReader::<SLOT_STRIDE>::new(&reader, 0);
    let sr_slot43 = SlotReader::<SLOT_STRIDE>::new(&reader, off43);

    c.bench_function("SlotReader/read_slot1_word0", |b| {
        b.iter(|| {
            black_box(sr_slot1.read(black_box(0)));
        });
    });

    c.bench_function("SlotReader/read_slot1_word0_rebind", |b| {
        b.iter(|| {
            let view = SlotReader::<SLOT_STRIDE>::new(&reader, 0);
            black_box(view.read(0));
        });
    });

    c.bench_function("SlotReader/read_slot43_word0", |b| {
        b.iter(|| {
            black_box(sr_slot43.read(black_box(0)));
        });
    });

    c.bench_function("SlotReader/sequential_scan_8_slots", |b| {
        b.iter(|| {
            for i in 1..=8 {
                let off = (i - 1) * SLOT_STRIDE;
                let sr = SlotReader::<SLOT_STRIDE>::new(&reader, off);
                black_box(sr.read(0));
            }
        });
    });
}

criterion_group!(benches, bench_slot_reader);
criterion_main!(benches);
