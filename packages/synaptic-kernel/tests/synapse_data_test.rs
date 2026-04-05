use synaptic_kernel::constants::SYNAPSE_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::topology::synapse::synapse_data::SynapseData;

// ============ IntoArray Layout ============

#[test]
fn synapse_data_to_array_field_layout() {
    let syn = SynapseData {
        kind: 99,
        source_ptr: 1,
        target_ptr: 2,
        outgoing_next_ptr: 3,
        outgoing_prev_ptr: 4,
        incoming_next_ptr: 5,
        incoming_prev_ptr: 6,
    };

    let arr = syn.to_array();

    // opcode is bit-packed: stored as opcode << 24 in field 0
    assert_eq!(arr[0], 99 << 24, "field 0: opcode (shifted)");
    assert_eq!(arr[1], 1, "field 1: source_ptr");
    assert_eq!(arr[2], 2, "field 2: target_ptr");
    assert_eq!(arr[3], 3, "field 3: outgoing_next_ptr");
    assert_eq!(arr[4], 4, "field 4: outgoing_prev_ptr");
    assert_eq!(arr[5], 5, "field 5: incoming_next_ptr");
    assert_eq!(arr[6], 6, "field 6: incoming_prev_ptr");
}

#[test]
fn synapse_data_reserved_fields_are_zero() {
    let syn = SynapseData {
        kind: 1,
        source_ptr: 2,
        target_ptr: 3,
        outgoing_next_ptr: 4,
        outgoing_prev_ptr: 5,
        incoming_next_ptr: 6,
        incoming_prev_ptr: 7,
    };

    let arr = syn.to_array();

    // field 7 is reserved (+4 bytes)
    for i in 7..SYNAPSE_SIZE {
        assert_eq!(arr[i], 0, "reserved field {} must be zero", i);
    }
}

#[test]
fn synapse_data_zero_state() {
    let syn = SynapseData {
        kind: 0,
        source_ptr: 0,
        target_ptr: 0,
        outgoing_next_ptr: 0,
        outgoing_prev_ptr: 0,
        incoming_next_ptr: 0,
        incoming_prev_ptr: 0,
    };

    let arr = syn.to_array();
    for i in 0..SYNAPSE_SIZE {
        assert_eq!(arr[i], 0, "field {} must be zero", i);
    }
}

#[test]
fn synapse_data_usize_to_i32_cast_round_trip() {
    let syn = SynapseData {
        kind: 0,
        source_ptr: i32::MAX as usize,
        target_ptr: 1,
        outgoing_next_ptr: 0,
        outgoing_prev_ptr: 0,
        incoming_next_ptr: 0,
        incoming_prev_ptr: 0,
    };

    let arr = syn.to_array();
    assert_eq!(arr[1], i32::MAX);
    assert_eq!(arr[2], 1);
}
