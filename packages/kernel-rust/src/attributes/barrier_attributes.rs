use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::AttributesView;

pub struct BarrierAttributes {
    pub phase_target: i32,
}

impl IntoNodeAttributesArray<16> for BarrierAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.phase_target;

        data
    }
}

pub struct BarrierAttributesView<'a>(pub AttributesView<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> BarrierAttributesView<'a> {
    pub fn phase_target(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_phase_target(&self, value: i32) {
        self.0.write(0, value)
    }
}
