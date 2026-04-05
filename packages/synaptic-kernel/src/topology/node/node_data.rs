use crate::constants::NODE_SIZE;
use crate::primitives::into_array::IntoArray;

pub struct NodeDraft {
    pub kind: i32,
}

pub struct NodeData {
    pub kind: i32,
    pub next_ptr: usize,
    pub prev_ptr: usize,
    pub outgoing_synapse_head: usize,
    pub outgoing_synapse_tail: usize,
    pub incoming_synapse_head: usize,
    pub incoming_synapse_tail: usize,
}

impl IntoArray<NODE_SIZE> for NodeData {
    fn to_array(&self) -> [i32; NODE_SIZE] {
        let mut data = [0; NODE_SIZE];

        data[0] = self.kind << 24;
        data[1] = self.next_ptr as i32;
        data[2] = self.prev_ptr as i32;
        data[3] = self.outgoing_synapse_head as i32;
        data[4] = self.outgoing_synapse_tail as i32;
        data[5] = self.incoming_synapse_head as i32;
        data[6] = self.incoming_synapse_tail as i32;

        data
    }
}
