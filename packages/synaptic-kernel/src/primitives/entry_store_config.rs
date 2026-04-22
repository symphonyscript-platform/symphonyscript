#[derive(Clone)]
pub struct EntryStoreConfig {
    pub core_stride: usize,
    pub meta_stride: usize,
    pub attr_stride: usize,
    pub capacity: usize,
}