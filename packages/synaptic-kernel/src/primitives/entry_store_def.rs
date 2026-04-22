use crate::primitives::triple_buffer_def::TripleBufferId;
use std::fmt;
use std::fmt::Formatter;

/// Typed identifier for an entry store within a `EntryStoreRegistryWriter`.
///
/// IDs occupy the range `[0, N-1]` where `N` is the registry's const-generic `N`.
#[repr(transparent)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct EntryStoreId(pub u16);

impl fmt::Display for EntryStoreId {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Definition of user-allocated entry store within the registry.
///
/// # Fields
/// - `id`: Unique identifier in `[0, N-1]`.
/// - `tb_id`: TB identifier. It's absolutely valid to use `TripleBufferId::DEFAULT` here.
/// - `capacity`: Entry store capacity of i32 numbers.
#[derive(Clone, Copy)]
pub struct EntryStoreDef {
    pub id: EntryStoreId,
    pub tb_id: TripleBufferId,
    pub core_stride: usize,
    pub meta_stride: usize,
    pub attr_stride: usize,
    pub capacity: usize,
}
