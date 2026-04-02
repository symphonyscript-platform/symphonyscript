use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attributes::writer::control_attributes_writer::{ControlAttributes, ControlAttributesWriter};
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::primitives::into_array::IntoArray;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = ControlAttributes { control_id: 74, value: 127 };
    let array = attrs.to_array();
    
    assert_eq!(array[0], 74);
    assert_eq!(array[1], 127);
    
    for i in 2..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = ControlAttributesWriter(AttributesWriter::new(&sab, 0));
    
    view.set_control_id(128);
    view.set_value(500);
    
    assert_eq!(view.control_id(), 128);
    assert_eq!(view.value(), 500);
}
