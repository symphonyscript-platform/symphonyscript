use std::sync::atomic::AtomicI32;
use std::sync::Arc;

// @todo: can be Arc<[AtomicI32]>
pub type AtomicBuffer = Arc<Vec<AtomicI32>>;
