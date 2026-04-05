use synaptic_kernel::constants::NODE_SLOT_SIZE;
use synaptic_kernel::primitives::into_array::IntoArray;
use synaptic_kernel::topology::node::node_data::NodeData;

// ============ IntoArray Layout ============

#[test]
fn node_data_to_array_field_layout() {
    let node = NodeData {
        kind: 42,
        base_tick: 100,
        next_ptr: 3,
        prev_ptr: 7,
        outgoing_synapse_head: 10,
        outgoing_synapse_tail: 11,
        incoming_synapse_head: 20,
        incoming_synapse_tail: 21,
        mod_head: 55,
    };

    let arr = node.to_array();

    // opcode is bit-packed: stored as opcode << 24 in field 0
    assert_eq!(arr[0], 42 << 24, "field 0: opcode (shifted)");
    assert_eq!(arr[1], 100, "field 1: base_tick");
    assert_eq!(arr[2], 3, "field 2: next_ptr");
    assert_eq!(arr[3], 7, "field 3: prev_ptr");
    assert_eq!(arr[4], 10, "field 4: outgoing_synapse_head");
    assert_eq!(arr[5], 11, "field 5: outgoing_synapse_tail");
    assert_eq!(arr[6], 20, "field 6: incoming_synapse_head");
    assert_eq!(arr[7], 21, "field 7: incoming_synapse_tail");
    assert_eq!(arr[8], 55, "field 8: mod_head");
}

#[test]
fn node_data_reserved_fields_are_zero() {
    let node = NodeData {
        kind: 1,
        base_tick: 2,
        next_ptr: 3,
        prev_ptr: 4,
        outgoing_synapse_head: 5,
        outgoing_synapse_tail: 6,
        incoming_synapse_head: 7,
        incoming_synapse_tail: 8,
        mod_head: 9,
    };

    let arr = node.to_array();

    // fields 9..NODE_SLOT_SIZE are reserved, must be zero
    for i in 9..NODE_SLOT_SIZE {
        assert_eq!(arr[i], 0, "reserved field {} must be zero", i);
    }
}

#[test]
fn node_data_usize_to_i32_cast_round_trip() {
    // Verify that usize -> i32 cast in to_array preserves values within i32 range
    let node = NodeData {
        kind: 0,
        base_tick: 0,
        next_ptr: i32::MAX as usize,
        prev_ptr: 1,
        outgoing_synapse_head: 0,
        outgoing_synapse_tail: 0,
        incoming_synapse_head: 0,
        incoming_synapse_tail: 0,
        mod_head: 0,
    };

    let arr = node.to_array();
    assert_eq!(arr[2], i32::MAX);
    assert_eq!(arr[3], 1);
}

#[test]
fn node_data_zero_state() {
    let node = NodeData {
        kind: 0,
        base_tick: 0,
        next_ptr: 0,
        prev_ptr: 0,
        outgoing_synapse_head: 0,
        outgoing_synapse_tail: 0,
        incoming_synapse_head: 0,
        incoming_synapse_tail: 0,
        mod_head: 0,
    };

    let arr = node.to_array();
    for i in 0..NODE_SLOT_SIZE {
        assert_eq!(arr[i], 0, "field {} must be zero", i);
    }
}
