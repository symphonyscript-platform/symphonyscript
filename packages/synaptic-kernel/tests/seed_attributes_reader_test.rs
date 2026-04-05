use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use synaptic_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use synaptic_kernel::attribute_plane::reader::seed_attributes_reader::SeedAttributesReader;
use synaptic_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use synaptic_kernel::attribute_plane::writer::seed_attributes_writer::SeedAttributes;

use synaptic_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn seed_attributes_reader() {
    let mem = create_mem(MEM_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, 0, CAPACITY);

    writer.set(
        0,
        SeedAttributes {
            seed_value: 12345678,
        },
    );

    let seed = SeedAttributesReader(reader.get(0));
    assert_eq!(seed.seed_value(), 12345678);
}
