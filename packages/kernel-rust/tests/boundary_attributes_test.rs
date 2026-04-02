use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attributes::writer::boundary_attributes_writer::{BoundaryAttributes, BoundaryAttributesWriter};
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
    let attrs = BoundaryAttributes { boundary_id: 42 };
    let array = attrs.to_array();
    
    assert_eq!(array[0], 42);
    for i in 1..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = BoundaryAttributesWriter(AttributesWriter::new(&sab, 0));
    
    view.set_boundary_id(100);
    assert_eq!(view.boundary_id(), 100);
}
