use crate::errors::table_error::TableError;

pub trait HashTable {
    fn compute_capacity(max_entries: u32, max_load_factor: f32) -> usize
    where
        Self: Sized;

    fn compute_end_index(start_index: usize, max_entries: u32, max_load_factor: f32) -> usize
    where
        Self: Sized;

    fn len(&self) -> i32;
    fn mem_start_offset(&self) -> usize;
    fn mem_end_offset(&self) -> usize;
    fn get(&self, key: i32) -> Option<i32>;
    fn set(&self, key: i32, value: i32) -> Result<(), TableError>;
    fn delete(&self, key: i32) -> Option<i32>;
}
