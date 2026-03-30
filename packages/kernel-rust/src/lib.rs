extern crate core;

pub mod primitives;
pub mod errors;
pub mod node_chain;
pub mod node_allocator;
pub mod node_chain_buffer;
pub mod attribute_plane;
pub mod attributes_view;
pub mod node_view;
pub mod into_attributes_array;
pub mod attributes;
pub mod constants;

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
