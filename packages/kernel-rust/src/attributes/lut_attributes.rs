use crate::constants::NODE_ATTRIBUTES_SLOT_SIZE;
use crate::into_array::IntoArray;
use crate::attributes_view::AttributesView;

pub struct LutAttributes {
    pub lut_index: i32,
}

impl IntoArray<16> for LutAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.lut_index;

        data
    }
}

pub struct LutAttributesView<'a>(pub AttributesView<'a, NODE_ATTRIBUTES_SLOT_SIZE>);

impl<'a> LutAttributesView<'a> {
    pub fn lut_index(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_lut_index(&self, value: i32) {
        self.0.write(0, value)
    }
}
