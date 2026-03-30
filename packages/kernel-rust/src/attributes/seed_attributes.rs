use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::AttributesView;

pub struct SeedAttributes {
    pub seed_value: i32,
}

impl IntoNodeAttributesArray<16> for SeedAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.seed_value;

        data
    }
}

pub struct SeedAttributesView<'a>(pub AttributesView<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SeedAttributesView<'a> {
    pub fn seed_value(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_seed_value(&self, value: i32) {
        self.0.write(0, value)
    }
}
