use crate::constants::SYNAPSE_SLOT_SIZE;
use crate::structural_plane::slot_writer::SlotWriter;

pub struct SynapseWriter<'a>(pub SlotWriter<'a, SYNAPSE_SLOT_SIZE>);

impl<'a> SynapseWriter<'a> {
    pub fn get_opcode(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub(crate) fn set_opcode(&self, value: i32) {
        let bitmask = self.0.read(0) & ((1 << 24) - 1);
        self.0.write(0, bitmask | value << 24)
    }

    pub fn get_source_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub(crate) fn set_source_ptr(&self, value: usize) {
        self.0.write(1, value as i32)
    }

    pub fn get_target_ptr(&self) -> usize {
        self.0.read(2) as usize
    }

    pub(crate) fn set_target_ptr(&self, value: usize) {
        self.0.write(2, value as i32)
    }

    pub fn get_outgoing_next_ptr(&self) -> usize {
        self.0.read(3) as usize
    }

    pub(crate) fn set_outgoing_next_ptr(&self, value: usize) {
        self.0.write(3, value as i32)
    }

    pub fn get_outgoing_prev_ptr(&self) -> usize {
        self.0.read(4) as usize
    }

    pub(crate) fn set_outgoing_prev_ptr(&self, value: usize) {
        self.0.write(4, value as i32)
    }

    pub fn get_incoming_next_ptr(&self) -> usize {
        self.0.read(5) as usize
    }

    pub(crate) fn set_incoming_next_ptr(&self, value: usize) {
        self.0.write(5, value as i32)
    }

    pub fn get_incoming_prev_ptr(&self) -> usize {
        self.0.read(6) as usize
    }

    pub(crate) fn set_incoming_prev_ptr(&self, value: usize) {
        self.0.write(6, value as i32)
    }
}

#[cfg(test)]
mod tests {
    use crate::constants::{NODE_SLOT_SIZE, SYNAPSE_SLOT_SIZE};
    use crate::primitives::simple_free_list::SimpleFreeList;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::SAB;
    use crate::structural_plane::node::node_chain_writer::NodeChainWriter;
    use crate::structural_plane::node::node_data::NodeDraft;
    use crate::structural_plane::structural_writer::StructuralWriter;
    use crate::structural_plane::synapse::synapse_chain_writer::SynapseChainWriter;
    use crate::structural_plane::synapse::synapse_data::SynapseDraft;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

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
        writer: crate::primitives::triple_buffer::TripleBufferWriter,
        _reader: crate::primitives::triple_buffer::TripleBufferReader,
        node_fl: SimpleFreeList,
        synapse_fl: SimpleFreeList,
    }

    fn setup() -> TestHarness {
        let sab = create_sab(SAB_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&sab), TB_START, TB_BUF_CAP);
        let node_fl = SimpleFreeList::new(Arc::clone(&sab), NODE_FL_START, NODE_CAPACITY);
        let synapse_fl = SimpleFreeList::new(Arc::clone(&sab), SYNAPSE_FL_START, SYNAPSE_CAPACITY);
        TestHarness {
            _sab: sab,
            writer,
            _reader: reader,
            node_fl,
            synapse_fl,
        }
    }

    #[test]
    fn synapse_writer_set_get_all_fields() {
        let h = setup();
        let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
            h.writer.clone(),
            h.node_fl.clone(),
            NODE_START_OFFSET,
            NODE_CAPACITY,
        );
        let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(
            h.writer.clone(),
            h.synapse_fl.clone(),
            SYNAPSE_START_OFFSET,
            SYNAPSE_CAPACITY,
        );
        let node_chain = NodeChainWriter::new(h.writer.clone(), node_sw.clone(), NODE_HEAD_OFFSET);
        let synapse_chain = SynapseChainWriter::new(node_chain.clone(), synapse_sw.clone());

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
            .connect(src, tgt, SynapseDraft { opcode: 5 })
            .unwrap();

        let s = synapse_chain.get(syn);

        // verify fields set by connect
        assert_eq!(s.get_opcode(), 5);
        assert_eq!(s.get_source_ptr(), src);
        assert_eq!(s.get_target_ptr(), tgt);

        // round-trip each setter/getter
        s.set_opcode(42);
        assert_eq!(s.get_opcode(), 42);

        s.set_source_ptr(99);
        assert_eq!(s.get_source_ptr(), 99);

        s.set_target_ptr(88);
        assert_eq!(s.get_target_ptr(), 88);

        s.set_outgoing_next_ptr(10);
        assert_eq!(s.get_outgoing_next_ptr(), 10);

        s.set_outgoing_prev_ptr(11);
        assert_eq!(s.get_outgoing_prev_ptr(), 11);

        s.set_incoming_next_ptr(20);
        assert_eq!(s.get_incoming_next_ptr(), 20);

        s.set_incoming_prev_ptr(21);
        assert_eq!(s.get_incoming_prev_ptr(), 21);
    }

    #[test]
    fn synapse_writer_opcode_bitmask_preserves_lower_bits() {
        let h = setup();
        let node_sw = StructuralWriter::<NODE_SLOT_SIZE>::new(
            h.writer.clone(),
            h.node_fl.clone(),
            NODE_START_OFFSET,
            NODE_CAPACITY,
        );
        let synapse_sw = StructuralWriter::<SYNAPSE_SLOT_SIZE>::new(
            h.writer.clone(),
            h.synapse_fl.clone(),
            SYNAPSE_START_OFFSET,
            SYNAPSE_CAPACITY,
        );
        let node_chain = NodeChainWriter::new(h.writer.clone(), node_sw.clone(), NODE_HEAD_OFFSET);
        let synapse_chain = SynapseChainWriter::new(node_chain.clone(), synapse_sw.clone());

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
            .connect(src, tgt, SynapseDraft { opcode: 0 })
            .unwrap();

        let s = synapse_chain.get(syn);

        // write lower 24 bits via raw slot view
        s.0.write(0, 0x00FFFFFF);
        s.set_opcode(0x7F);

        let raw = s.0.read(0);
        assert_eq!(raw >> 24, 0x7F, "upper 8 bits = opcode");
        assert_eq!(raw & 0x00FFFFFF, 0x00FFFFFF, "lower 24 bits preserved");
    }
}
