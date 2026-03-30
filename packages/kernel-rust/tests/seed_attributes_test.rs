use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::node::seed_attributes::{SeedAttributes, SeedAttributesView};
use symphonyscript_kernel::node_attributes_view::NodeAttributesView;
use symphonyscript_kernel::into_node_attributes_array::IntoNodeAttributesArray;

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
    let view = SeedAttributesView(NodeAttributesView::new(&sab, 0));
    
    view.set_seed_value(12345);
    assert_eq!(view.seed_value(), 12345);
}
