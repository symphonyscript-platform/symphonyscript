use crate::into_node_attributes_array::IntoNodeAttributesArray;
use crate::node_attributes_view::NodeAttributesView;

pub struct ControlAttributes {
    pub control_id: i32,
    pub value: i32,
}

impl IntoNodeAttributesArray<16> for ControlAttributes {
    fn to_array(&self) -> [i32; 16] {
        let mut data = [0; 16];

        data[0] = self.control_id;
        data[1] = self.value;

        data
    }
}

pub struct NoteAttributesView<'a>(pub NodeAttributesView<'a>);

impl<'a> crate::node::note_attributes::NoteAttributesView<'a> {
    pub fn control_id(&self) -> i32 {
        self.0.read(0)
    }

    pub fn set_control_id(&self, value: i32) {
        self.0.write(0, value)
    }

    pub fn value(&self) -> i32 {
        self.0.read(1)
    }

    pub fn set_value(&self, value: i32) {
        self.0.write(1, value)
    }
}
