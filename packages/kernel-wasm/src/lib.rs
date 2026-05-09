pub mod wasm_kernel_controller;
pub mod hash_table;
pub mod slot_view;
pub mod free_list;
pub mod slot_handle;
pub mod table_error;
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
