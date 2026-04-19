extern crate core;

pub mod constants;
pub mod control_plane;
pub mod errors;
pub mod epoch_consumer;
pub mod kernel;
pub mod metadata;
pub mod primitives;
pub mod serialized_kernel;
pub mod kernel_config;
pub mod epoch_mirror;
pub mod epoch;
pub mod topology;
pub mod wide_atomic;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
