use std::sync::Arc;
use std::sync::atomic::AtomicI32;

pub type SAB = Arc<Vec<AtomicI32>>;
