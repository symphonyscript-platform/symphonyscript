use std::fmt;
use std::fmt::Formatter;
use std::num::NonZeroU32;

/// Typed identifier for slots..
#[repr(transparent)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SlotId(NonZeroU32);

impl fmt::Display for SlotId {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
