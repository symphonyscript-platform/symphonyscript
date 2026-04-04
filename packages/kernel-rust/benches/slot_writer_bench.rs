use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphonyscript_kernel::structural_plane::structural_writer::StructuralWriter;

fn create_sab(size: usize) -> SAB {
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

const SAB_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const FL_START: usize = 50000;
const CAPACITY: usize = 512;
const TB_OFFSET: usize = 0;

fn setup() -> (SAB, symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter, symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader) {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    (sab, writer, reader)
}

fn bench_slot_writer(c: &mut Criterion) {
    let (sab, writer, _reader) = setup();

    let sw: StructuralWriter<16> = StructuralWriter::new(
        Arc::clone(&sab),
        writer.clone(),
        FL_START,
        TB_OFFSET,
        CAPACITY,
    );
    let slot = sw.insert(TestPayload { a: 42, b: 99 }).unwrap();

    c.bench_function("StructuralWriter/write_field", |b| {
        b.iter(|| {
            sw.write_field(black_box(slot), black_box(0), black_box(123));
        });
    });

    c.bench_function("StructuralWriter/read_field", |b| {
        b.iter(|| {
            black_box(sw.read_field(black_box(slot), black_box(0)));
        });
    });

    c.bench_function("StructuralWriter/get_view", |b| {
        b.iter(|| {
            let view = sw.get(black_box(slot));
            black_box(view.read(0));
        });
    });

}

criterion_group!(benches, bench_slot_writer);
criterion_main!(benches);
