use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attribute_plane::reader::barrier_attributes_reader::BarrierAttributesReader;
use symphonyscript_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attribute_plane::writer::barrier_attributes_writer::BarrierAttributes;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn barrier_attributes_reader() {
    let mem = create_mem(MEM_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(0, BarrierAttributes { phase_target: 42 });

    let barrier = BarrierAttributesReader(reader.get(0));
    assert_eq!(barrier.phase_target(), 42);
}
