use crate::constants::SYNAPSE_ATTRIBUTES_SLOT_SIZE;
use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::AttributesView;

pub struct SeedAttributes {
    pub weight: i32,
    pub tick_offset: i32,
    pub transpose: i32,
    pub volume_scale: i32,
}

impl IntoNodeAttributesArray<16> for SeedAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.seed_value;

        data
    }
}

pub struct SeedAttributesView<'a>(pub AttributesView<'a, SYNAPSE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> SeedAttributesView<'a> {
    pub fn weight(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_weight(&self, value: i32) {
        self.0.write(0, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.0.read(1)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.0.write(1, value)
    }

    pub fn transpose(&self) -> i32 {
        self.0.read(2)
    }

    pub fn set_transpose(&self, value: i32) {
        self.0.write(2, value)
    }

    pub fn volume_scale(&self) -> i32 {
        self.0.read(3)
    }

    pub fn set_volume_scale(&self, value: i32) {
        self.0.write(3, value)
    }
}
