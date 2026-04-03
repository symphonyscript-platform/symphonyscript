use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attributes::reader::attribute_plane_reader::AttributePlaneReader;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const SAB_SIZE: usize = 4096;
const CAPACITY: usize = 16;

// ============ AttributePlaneReader: construction ============

#[test]
fn plane_reader_new_and_end_index() {
    let sab = create_sab(SAB_SIZE);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::new(sab, 0, CAPACITY);
    assert_eq!(reader.end_index(), CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE);
}

#[test]
fn plane_reader_bind_with_nonzero_start() {
    let sab = create_sab(SAB_SIZE);
    let start = 250;
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(sab, start, CAPACITY);
    assert_eq!(
        reader.end_index(),
        start + CAPACITY * NODE_ATTRIBUTES_SLOT_SIZE
    );
}
