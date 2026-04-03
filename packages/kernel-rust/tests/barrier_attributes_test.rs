use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::attributes::writer::attributes_writer::AttributesWriter;
use symphonyscript_kernel::attributes::writer::barrier_attributes_writer::{
    BarrierAttributes, BarrierAttributesWriter,
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
    let attrs = BarrierAttributes { phase_target: 480 };
    let array = attrs.to_array();

    assert_eq!(array[0], 480);
    // ensure the rest are strictly zeroed out
    for i in 1..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = BarrierAttributesWriter(AttributesWriter::new(&sab, 0));

    view.set_phase_target(960);
    assert_eq!(view.phase_target(), 960);
}
