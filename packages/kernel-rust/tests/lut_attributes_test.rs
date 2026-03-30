use std::sync::Arc;
use std::sync::atomic::AtomicI32;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::node::lut_attributes::{LutAttributes, LutAttributesView};
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
    let attrs = LutAttributes { lut_index: 3 };
    let array = attrs.to_array();
    
    assert_eq!(array[0], 3);
    for i in 1..16 {
        assert_eq!(array[i], 0);
    }
}

#[test]
fn view_round_trip() {
    let sab = create_sab(32);
    let view = LutAttributesView(NodeAttributesView::new(&sab, 0));
    
    view.set_lut_index(5);
    assert_eq!(view.lut_index(), 5);
}
