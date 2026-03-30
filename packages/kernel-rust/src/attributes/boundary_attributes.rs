use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::AttributesView;

pub struct BoundaryAttributes {
    pub boundary_id: i32,
}

impl IntoNodeAttributesArray<16> for BoundaryAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.boundary_id;

        data
    }
}

pub struct BoundaryAttributesView<'a>(pub AttributesView<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> BoundaryAttributesView<'a> {
    pub fn boundary_id(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_boundary_id(&self, value: i32) {
        self.0.write(0, value)
    }
}
