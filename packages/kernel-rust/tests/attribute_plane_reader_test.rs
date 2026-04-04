use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const MEM_SIZE: usize = 4096;
const CAPACITY: usize = 16;

// ============ AttributePlaneReader: construction ============

#[test]
fn plane_reader_new_and_end_index() {
    let mem = create_mem(MEM_SIZE);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::new(mem, 0, CAPACITY);
    assert_eq!(reader.mem_end_offset(), CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE);
}

#[test]
fn plane_reader_bind_with_nonzero_start() {
    let mem = create_mem(MEM_SIZE);
    let start = 250;
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(mem, start, CAPACITY);
    assert_eq!(
        reader.mem_end_offset(),
        start + CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE
    );
}
