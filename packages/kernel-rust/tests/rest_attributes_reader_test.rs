use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attributes::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attributes::reader::rest_attributes_reader::RestAttributesReader;
use symphonyscript_kernel::attributes::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attributes::writer::rest_attributes_writer::RestAttributes;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const SAB_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn rest_attributes_reader() {
    let sab = create_sab(SAB_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(sab.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(sab, 0, CAPACITY);

    writer.set(0, RestAttributes { duration: 960 });

    let rest = RestAttributesReader(reader.get(0));
    assert_eq!(rest.duration(), 960);
}
