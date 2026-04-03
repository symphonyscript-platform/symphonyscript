use std::sync::atomic::AtomicI32;
use std::sync::Arc;

use symphonyscript_kernel::attributes::reader::attribute_plane_reader::AttributePlaneReader;
use symphonyscript_kernel::attributes::reader::control_attributes_reader::ControlAttributesReader;
use symphonyscript_kernel::attributes::writer::attribute_plane_writer::AttributePlaneWriter;
use symphonyscript_kernel::attributes::writer::control_attributes_writer::ControlAttributes;

use symphonyscript_kernel::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    Arc::new((0..size).map(|_| AtomicI32::new(0)).collect())
}

const SAB_SIZE: usize = 4096;
const CAPACITY: usize = 16;

#[test]
fn control_attributes_reader() {
    let sab = create_sab(SAB_SIZE);
    let writer = AttributePlaneWriter::<NODE_ATTRIBUTES_SLOT_SIZE>::new(sab.clone(), 0, CAPACITY);
    let reader = AttributePlaneReader::<NODE_ATTRIBUTES_SLOT_SIZE>::bind(sab, 0, CAPACITY);

    writer.set(
        0,
        ControlAttributes {
            control_id: 64,
            value: 127,
        },
    );

    let ctrl = ControlAttributesReader(reader.get(0));
    assert_eq!(ctrl.control_id(), 64);
    assert_eq!(ctrl.value(), 127);
}
