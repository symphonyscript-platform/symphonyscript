use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::NodeAttributesView;

pub struct LutAttributes {
    pub lut_index: i32,
}

impl IntoNodeAttributesArray<16> for LutAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.lut_index;

        data
    }
}

pub struct LutAttributesView<'a>(pub NodeAttributesView<'a>);

impl<'a> LutAttributesView<'a> {
    pub fn lut_index(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_lut_index(&self, value: i32) {
        self.0.write(0, value)
    }
}
