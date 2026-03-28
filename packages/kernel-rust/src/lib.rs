extern crate core;

pub mod primitives;
pub mod errors;
pub mod node_chain;
pub mod node_allocator;
pub mod node_chain_buffer;

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
