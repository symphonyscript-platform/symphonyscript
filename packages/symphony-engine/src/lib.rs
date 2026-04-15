pub mod attributes;
pub mod barrier_operations;
pub mod boundary_operations;
pub mod constants;
pub mod control_operations;
pub mod lut_operations;
pub mod metadata_operations;
pub mod node_operations;
pub mod note_operations;
pub mod rest_operations;
pub mod seed_operations;
pub mod symphony_engine;
pub mod synapse_operations;

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
