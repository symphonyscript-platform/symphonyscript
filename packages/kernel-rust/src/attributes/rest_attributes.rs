use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::AttributesView;

pub struct RestAttributes {
    pub duration: i32,
}

impl IntoNodeAttributesArray<16> for RestAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.duration;

        data
    }
}

pub struct RestAttributesView<'a>(pub AttributesView<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> RestAttributesView<'a> {
    pub fn duration(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_duration(&self, value: i32) {
        self.0.write(0, value)
    }
}
