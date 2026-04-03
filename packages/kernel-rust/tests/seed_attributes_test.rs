use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::attributes::writer::seed_attributes_writer::{
    SeedAttributes, SeedAttributesWriter,
};
use symphonyscript_kernel::primitives::into_array::IntoArray;
use symphonyscript_kernel::primitives::types::SAB;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = SeedAttributes { seed_value: 999999 };
    let array = attrs.to_array();

    assert_eq!(array[0], 999999);
    for i in 1..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = SeedAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_seed_value(12345);
    assert_eq!(view.seed_value(), 12345);
}
