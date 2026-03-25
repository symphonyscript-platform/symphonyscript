use crate::errors::table_error::TableError;

pub trait HashTable {
    fn len(&self) -> u32;
    fn get(&self, key: i32) -> Option<i32>;
    fn set(&self, key: i32, value: i32) -> Result<(), TableError>;
    fn delete(&self, key: i32) -> Option<i32>;
}
