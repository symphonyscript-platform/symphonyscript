use crate::primitives::hash_table::constants::EMPTY_HASH;

#[derive(Clone, Copy, Debug)]
pub struct TableSlot {
    pub hash: i32,
    pub key: i32,
    pub value: i32,
}

impl TableSlot {
    pub fn empty() -> Self {
        TableSlot {
            hash: 0,
            key: 0,
            value: 0,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.hash == EMPTY_HASH
    }
}
