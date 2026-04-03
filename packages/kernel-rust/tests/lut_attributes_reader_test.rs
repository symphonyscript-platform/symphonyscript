use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attribute_plane::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attribute_plane::reader::lut_attributes_reader::LutAttributesReader;
use symphonyscript_kernel::attribute_plane::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attribute_plane::writer::lut_attributes_writer::LutAttributes;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const SAB_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn lut_attributes_reader() {
    let sab = create_sab(SAB_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(sab.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(sab, 0, CAPACITY);

    writer.set(0, LutAttributes { lut_index: 777 });

    let lut = LutAttributesReader(reader.get(0));
    assert_eq!(lut.lut_index(), 777);
}
