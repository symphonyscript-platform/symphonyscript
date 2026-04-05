use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use synaptic_kernel::attribute_plane::writer::attributes_writer::AttributesWriter;
use synaptic_kernel::attribute_plane::writer::control_attributes_writer::{
    ControlAttributes, ControlAttributesWriter,
};
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::primitives::types::AtomicBuffer;

fn create_mem(size: usize) -> AtomicBuffer {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = ControlAttributes {
        control_id: 74,
        value: 127,
    };
    let array = attrs.to_array();

    assert_eq!(array[0], 74);
    assert_eq!(array[1], 127);

    for i in 2..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let mem = create_mem(32);
    let view = ControlAttributesWriter(AttributesWriter::new(&mem, 0));

    view.set_control_id(128);
    view.set_value(500);

    assert_eq!(view.control_id(), 128);
    assert_eq!(view.value(), 500);
}
