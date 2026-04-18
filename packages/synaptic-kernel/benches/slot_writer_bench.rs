use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter;
use synaptic_kernel::primitives::tb_zone_writer::TbZoneWriter;

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
const TB_OFFSET: usize = 0;
const SLOT_WORDS: usize = 16;

fn setup() -> synaptic_kernel::primitives::triple_buffer_writer::TripleBufferWriter {
    let mem = create_mem(MEM_SIZE);
    let (writer, _reader) = TripleBufferWriter::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    writer
}

fn bench_slot_writer(c: &mut Criterion) {
    let writer = setup();
    let sw = TbZoneWriter::<SLOT_WORDS>::new(&writer, TB_OFFSET);

    c.bench_function("TripleBufferWriter/write_into_slot", |b| {
        b.iter(|| {
            writer.write(TB_OFFSET + black_box(0), black_box(123));
        });
    });

    c.bench_function("SlotWriter/read", |b| {
        b.iter(|| {
            black_box(sw.read(black_box(0)));
        });
    });

    c.bench_function("SlotWriter/read_after_rebind", |b| {
        b.iter(|| {
            let view = TbZoneWriter::<SLOT_WORDS>::new(&writer, TB_OFFSET);
            black_box(view.read(0));
        });
    });
}

criterion_group!(benches, bench_slot_writer);
criterion_main!(benches);
