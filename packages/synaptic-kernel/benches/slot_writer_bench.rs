use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use synaptic_kernel::primitives::types::AtomicBuffer;
use synaptic_kernel::primitives::triple_buffer::TripleBuffer;
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::topology::topology_writer::TopologyWriter;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

struct TestPayload { a: i32, b: i32 }

impl IntoArray<16> for TestPayload {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];
        data[0] = self.a;
        data[1] = self.b;
        data
    }
}

const MEM_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const FL_START: usize = 50000;
const CAPACITY: usize = 512;
const TB_OFFSET: usize = 0;

fn setup() -> (AtomicBuffer, synaptic_kernel::primitives::triple_buffer::TripleBufferWriter, synaptic_kernel::primitives::triple_buffer::TripleBufferReader) {
    let mem = create_mem(MEM_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);
    (mem, writer, reader)
}

fn bench_slot_writer(c: &mut Criterion) {
    let (mem, writer, _reader) = setup();

    let sw: TopologyWriter<16> = TopologyWriter::new(
        Arc::clone(&mem),
        writer.clone(),
        FL_START,
        TB_OFFSET,
        CAPACITY,
    );
    let slot = sw.insert(TestPayload { a: 42, b: 99 }).unwrap();

    c.bench_function("TopologyWriter/write_field", |b| {
        b.iter(|| {
            sw.write_field(black_box(slot), black_box(0), black_box(123));
        });
    });

    c.bench_function("TopologyWriter/read_field", |b| {
        b.iter(|| {
            black_box(sw.read_field(black_box(slot), black_box(0)));
        });
    });

    c.bench_function("TopologyWriter/get_view", |b| {
        b.iter(|| {
            let view = sw.get(black_box(slot));
            black_box(view.read(0));
        });
    });

}

criterion_group!(benches, bench_slot_writer);
criterion_main!(benches);
