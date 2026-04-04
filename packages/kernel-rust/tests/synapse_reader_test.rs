use std::sync::atomic::AtomicI32;
use std::sync::Arc;
use symphonyscript_kernel::constants::{NODE_SLOT_SIZE, SYNAPSE_SLOT_SIZE};
use symphonyscript_kernel::primitives::triple_buffer::TripleBuffer;
use symphonyscript_kernel::primitives::types::SAB;
use symphonyscript_kernel::structural_plane::node::node_chain_writer::NodeChainWriter;
use symphonyscript_kernel::structural_plane::node::node_data::NodeDraft;
use symphonyscript_kernel::structural_plane::structural_reader::StructuralReader;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_reader::SynapseChainReader;
use symphonyscript_kernel::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
use symphonyscript_kernel::structural_plane::synapse::synapse_data::SynapseDraft;

fn create_sab(size: usize) -> SAB {
    let mut vec = Vec::with_capacity(size);
    for _ in 0..size {
        vec.push(AtomicI32::new(0));
    }
    Arc::new(vec)
}

const SAB_SIZE: usize = 65536;
const TB_START: usize = 0;
const TB_BUF_CAP: usize = 16384;
const NODE_CAPACITY: usize = 16;
const SYNAPSE_CAPACITY: usize = 32;
const NODE_START_OFFSET: usize = 0;
const NODE_HEAD_OFFSET: usize = NODE_CAPACITY * NODE_SLOT_SIZE;
const SYNAPSE_START_OFFSET: usize = NODE_HEAD_OFFSET + 1;
const NODE_FL_START: usize = 50000;
const SYNAPSE_FL_START: usize = 51000;

struct TestHarness {
    _sab: SAB,
    writer: symphonyscript_kernel::primitives::triple_buffer::TripleBufferWriter,
    reader: symphonyscript_kernel::primitives::triple_buffer::TripleBufferReader,
    node_chain: NodeChainWriter,
    synapse_chain: SynapseChainWriter,
    synapse_chain_r: SynapseChainReader,
}

fn setup() -> TestHarness {
    let sab = create_sab(SAB_SIZE);
    let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
    let node_chain = NodeChainWriter::new(
        Arc::clone(&sab),
        writer.clone(),
        NODE_FL_START,
        NODE_START_OFFSET,
        NODE_CAPACITY,
    );
    let synapse_chain = SynapseChainWriter::new(
        Arc::clone(&sab),
        writer.clone(),
        node_chain.clone(),
        SYNAPSE_FL_START,
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );
    let synapse_chain_r =
        SynapseChainReader::new(reader.clone(), SYNAPSE_START_OFFSET, SYNAPSE_CAPACITY);
    TestHarness {
        _sab: sab,
        writer,
        reader,
        node_chain,
        synapse_chain,
        synapse_chain_r,
    }
}

#[test]
fn reader_sees_all_synapse_fields_after_publish() {
    let mut h = setup();

    let (src, tgt, syn) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain
            .insert_head(NodeDraft {
                opcode: 1,
                base_tick: 0,
            })
            .unwrap();
        let tgt = node_chain
            .insert_head(NodeDraft {
                opcode: 2,
                base_tick: 0,
            })
            .unwrap();
        let syn = synapse_chain
            .connect(src, tgt, SynapseDraft { opcode: 42 })
            .unwrap();
        (src, tgt, syn)
    };
    h.writer.publish();
    h.reader.swap();

    let synapse_sr = StructuralReader::<SYNAPSE_SLOT_SIZE>::new(
        h.reader.clone(),
        SYNAPSE_START_OFFSET,
        SYNAPSE_CAPACITY,
    );
    let synapse_chain_r = h.synapse_chain_r;
    let s = synapse_chain_r.get(syn);
    assert_eq!(s.get_opcode(), 42);
    assert_eq!(s.get_source_ptr(), src);
    assert_eq!(s.get_target_ptr(), tgt);
    assert_eq!(s.get_outgoing_next_ptr(), 0);
    assert_eq!(s.get_outgoing_prev_ptr(), 0);
    assert_eq!(s.get_incoming_next_ptr(), 0);
    assert_eq!(s.get_incoming_prev_ptr(), 0);
}

#[test]
fn reader_sees_chain_pointers_with_multiple_synapses() {
    let mut h = setup();

    let (src, s1, s2, s3) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain
            .insert_head(NodeDraft {
                opcode: 1,
                base_tick: 0,
            })
            .unwrap();
        let tgt1 = node_chain
            .insert_head(NodeDraft {
                opcode: 2,
                base_tick: 0,
            })
            .unwrap();
        let tgt2 = node_chain
            .insert_head(NodeDraft {
                opcode: 3,
                base_tick: 0,
            })
            .unwrap();
        let tgt3 = node_chain
            .insert_head(NodeDraft {
                opcode: 4,
                base_tick: 0,
            })
            .unwrap();

        let s1 = synapse_chain
            .connect(src, tgt1, SynapseDraft { opcode: 10 })
            .unwrap();
        let s2 = synapse_chain
            .connect(src, tgt2, SynapseDraft { opcode: 20 })
            .unwrap();
        let s3 = synapse_chain
            .connect(src, tgt3, SynapseDraft { opcode: 30 })
            .unwrap();
        (src, s1, s2, s3)
    };
    h.writer.publish();
    h.reader.swap();

    let reader = h.synapse_chain_r;

    // verify outgoing chain traversal via reader: s1 -> s2 -> s3
    let r1 = reader.get(s1);
    assert_eq!(r1.get_opcode(), 10);
    assert_eq!(r1.get_source_ptr(), src);
    assert_eq!(r1.get_outgoing_prev_ptr(), 0, "s1 is head");
    assert_eq!(r1.get_outgoing_next_ptr(), s2);

    let r2 = reader.get(s2);
    assert_eq!(r2.get_opcode(), 20);
    assert_eq!(r2.get_outgoing_prev_ptr(), s1);
    assert_eq!(r2.get_outgoing_next_ptr(), s3);

    let r3 = reader.get(s3);
    assert_eq!(r3.get_opcode(), 30);
    assert_eq!(r3.get_outgoing_prev_ptr(), s2);
    assert_eq!(r3.get_outgoing_next_ptr(), 0, "s3 is tail");
}

#[test]
fn reader_does_not_see_unpublished_changes() {
    let mut h = setup();

    // publish initial state with one synapse
    let (src, tgt, s1) = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain.clone();

        let src = node_chain
            .insert_head(NodeDraft {
                opcode: 1,
                base_tick: 0,
            })
            .unwrap();
        let tgt = node_chain
            .insert_head(NodeDraft {
                opcode: 2,
                base_tick: 0,
            })
            .unwrap();
        let s1 = synapse_chain
            .connect(src, tgt, SynapseDraft { opcode: 10 })
            .unwrap();
        (src, tgt, s1)
    };
    h.writer.publish();
    h.reader.swap();

    // add second synapse but DON'T publish
    {
        let synapse_chain = h.synapse_chain.clone();
        synapse_chain
            .connect(src, tgt, SynapseDraft { opcode: 20 })
            .unwrap();
    }
    // no publish, no swap

    // reader still sees old snapshot
    let reader = h.synapse_chain_r;
    let r1 = reader.get(s1);
    assert_eq!(r1.get_opcode(), 10);
    assert_eq!(
        r1.get_outgoing_next_ptr(),
        0,
        "reader still sees s1 as tail"
    );
}

#[test]
fn reader_sees_disconnect_after_publish() {
    let mut h = setup();

    let s2 = {
        let node_chain = h.node_chain;
        let synapse_chain = h.synapse_chain;

        let src = node_chain
            .insert_head(NodeDraft {
                opcode: 1,
                base_tick: 0,
            })
            .unwrap();
        let tgt1 = node_chain
            .insert_head(NodeDraft {
                opcode: 2,
                base_tick: 0,
            })
            .unwrap();
        let tgt2 = node_chain
            .insert_head(NodeDraft {
                opcode: 3,
                base_tick: 0,
            })
            .unwrap();

        let s1 = synapse_chain
            .connect(src, tgt1, SynapseDraft { opcode: 10 })
            .unwrap();
        let s2 = synapse_chain
            .connect(src, tgt2, SynapseDraft { opcode: 20 })
            .unwrap();
        // outgoing: s1 -> s2

        synapse_chain.disconnect(s1);
        // outgoing: s2
        s2
    };
    h.writer.publish();
    h.reader.swap();

    let reader = h.synapse_chain_r;
    let r2 = reader.get(s2);
    assert_eq!(r2.get_opcode(), 20);
    assert_eq!(
        r2.get_outgoing_prev_ptr(),
        0,
        "s2 is now head after disconnect"
    );
    assert_eq!(r2.get_outgoing_next_ptr(), 0, "s2 is also tail");
}
