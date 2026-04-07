/// Conversion trait for serializing a type into a fixed-size `[i32; SLOT_SIZE]` array.
///
/// Used by attribute plane writers to accept user-defined structs and store them as
/// flat `i32` slots in the backing `AtomicBuffer`.
pub trait IntoArray<const SLOT_SIZE: usize> {
    fn to_array(&self) -> [i32; SLOT_SIZE];
}
