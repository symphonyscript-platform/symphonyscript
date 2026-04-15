use crate::symphony_engine::SymphonyEngine;

pub trait MetadataOperations {
    fn mem_metadata_capacity(&self) -> usize;
    fn tb_metadata_capacity(&self) -> usize;

    fn mem_read_meta(&self, offset: usize) -> i32;
    fn mem_write_meta(&self, offset: usize, value: i32);

    fn tb_read_meta(&self, offset: usize) -> i32;
    fn tb_write_meta(&self, offset: usize, value: i32);
}

impl MetadataOperations for SymphonyEngine {
    fn mem_metadata_capacity(&self) -> usize {
        self.kernel.mem_metadata_capacity()
    }

    fn tb_metadata_capacity(&self) -> usize {
        self.kernel.tb_metadata_capacity()
    }

    fn mem_read_meta(&self, offset: usize) -> i32 {
        self.kernel.mem_read_meta(offset)
    }

    fn mem_write_meta(&self, offset: usize, value: i32) {
        self.kernel.mem_write_meta(offset, value);
    }

    fn tb_read_meta(&self, offset: usize) -> i32 {
        self.kernel.tb_read_meta(offset)
    }

    fn tb_write_meta(&self, offset: usize, value: i32) {
        self.kernel.tb_write_meta(offset, value);
    }
}
