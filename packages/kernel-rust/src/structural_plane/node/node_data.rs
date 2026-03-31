use crate::constants::NODE_SLOT_SIZE;
use crate::primitives::into_array::IntoArray;

pub struct NodeDraft {
    pub opcode: i32,
    pub base_tick: i32,
}

pub struct NodeData {
    pub opcode: i32,
    pub base_tick: i32,
    pub next_ptr: usize,
    pub prev_ptr: usize,
    pub synapse_list_head: usize,
    pub reverse_synapse_head: usize,
    pub mod_list_head: usize,
    // +4 bytes reserved
}

impl IntoArray<8> for NodeData {
    fn to_array(&self) -> [i32; NODE_SLOT_SIZE] {
        let mut data = [0; NODE_SLOT_SIZE];

        data[0] = self.opcode;
        data[1] = self.base_tick;
        data[2] = self.next_ptr as i32;
        data[3] = self.prev_ptr as i32;
        data[4] = self.synapse_list_head as i32;
        data[5] = self.reverse_synapse_head as i32;
        data[6] = self.mod_list_head as i32;

        data
    }
}
