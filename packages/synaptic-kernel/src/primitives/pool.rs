use crate::primitives::triple_buffer_def::TripleBufferId;
use crate::primitives::types::AtomicBuffer;
use std::fmt;
use std::fmt::Formatter;

#[repr(transparent)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PoolId(pub u16);

impl fmt::Display for PoolId {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[repr(transparent)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SlotId(pub usize);

impl fmt::Display for SlotId {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

pub struct Pool {
    capacity: u16,
    clusters: Vec<Cluster>,
}

pub enum Storage {
    Tb(TripleBufferId),
    Mem,
}

pub struct Cluster {
    storage: Storage,
    stride_i32: u16,
}

impl Pool {
    pub fn new(mem: AtomicBuffer, capacity: u16, clusters: Vec<Cluster>) -> Self {
        Pool { capacity, clusters }
    }
}
