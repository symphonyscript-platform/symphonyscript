use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::simple_free_list::SimpleFreeList;
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

fn setup() -> (SAB, symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter, symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader, SimpleFreeList) {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let free_list = SimpleFreeList::new(Arc::clone(&sab), FL_START, CAPACITY);
    (sab, writer, reader, free_list)
}

fn bench_slot_writer(c: &mut Criterion) {
    let (_sab, writer, _reader, free_list) = setup();

    // Pre-insert a slot for read/write benchmarks
    let sw: StructuralWriter<16> = StructuralWriter::new(writer.clone(), free_list.clone(), 0, CAPACITY);
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

    c.bench_function("StructuralWriter/insert+free_cycle", |b| {
        b.iter(|| {
            let s = sw.insert(TestPayload { a: black_box(1), b: black_box(2) }).unwrap();
            sw.defer_free(s).unwrap();
        });
    });
}

criterion_group!(benches, bench_slot_writer);
criterion_main!(benches);
