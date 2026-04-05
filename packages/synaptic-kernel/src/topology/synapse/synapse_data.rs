use crate::constants::SYNAPSE_SIZE;
use crate::primitives::into_array::IntoArray;

pub struct SynapseDraft {
    pub kind: i32,
}

pub struct SynapseData {
    pub kind: i32,
    pub source_ptr: usize,
    pub target_ptr: usize,
    pub outgoing_next_ptr: usize,
    pub outgoing_prev_ptr: usize,
    pub incoming_next_ptr: usize,
    pub incoming_prev_ptr: usize,
    // +4 bytes reserved
}

impl IntoArray<SYNAPSE_SIZE> for SynapseData {
    fn to_array(&self) -> [i32; SYNAPSE_SIZE] {
        let mut data = [0; SYNAPSE_SIZE];

        data[0] = self.kind << 24;
        data[1] = self.source_ptr as i32;
        data[2] = self.target_ptr as i32;
        data[3] = self.outgoing_next_ptr as i32;
        data[4] = self.outgoing_prev_ptr as i32;
        data[5] = self.incoming_next_ptr as i32;
        data[6] = self.incoming_prev_ptr as i32;

        data
    }
}
