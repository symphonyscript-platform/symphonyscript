pub trait IntoNodeAttributesArray<const SLOT_SIZE: usize> {
    fn to_array(&self) -> [i32; SLOT_SIZE];
}
