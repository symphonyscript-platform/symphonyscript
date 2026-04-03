extern crate core;

pub mod primitives;
pub mod errors;
pub mod attribute_plane;
pub mod constants;
pub mod writer_structural_plane;
pub mod structural_plane;
pub mod synaptic_graph_writer;
pub mod synaptic_graph_reader;
pub mod kernel_processor;
pub mod kernel_controller;
pub mod synaptic_graph_config;
pub mod control_plane;

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
