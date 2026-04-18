use std::fmt;
use std::fmt::Formatter;

#[repr(transparent)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct TripleBufferId(pub u16);

impl fmt::Display for TripleBufferId {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone, Copy)]
pub struct TripleBufferDef {
    pub id: TripleBufferId,
    pub buffer_capacity: usize,
}
