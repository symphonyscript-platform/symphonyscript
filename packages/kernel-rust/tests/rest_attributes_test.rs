use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::attributes::rest_attributes::{RestAttributes, RestAttributesView};
use symphonyscript_kernel::attributes_view::AttributesView;
use symphonyscript_kernel::into_array::IntoArray;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

#[test]
fn to_array_maps_slots_correctly() {
    let attrs = RestAttributes { duration: 960 };
    let array = attrs.to_array();
    
    assert_eq!(array[0], 960);
    for i in 1..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = RestAttributesView(AttributesView::new(&sab, 0));
    
    view.set_duration(480);
    assert_eq!(view.duration(), 480);
}
