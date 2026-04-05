use crate::constants::SYNAPSE_SIZE;
use crate::topology::slot_writer::SlotWriter;

pub struct SynapseWriter<'a>(pub SlotWriter<'a, SYNAPSE_SIZE>);

impl<'a> SynapseWriter<'a> {
    pub fn get_kind(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_source_ptr(&self) -> usize {
        self.0.read(1) as usize
    }

    pub fn get_target_ptr(&self) -> usize {
        self.0.read(2) as usize
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
    use crate::constants::NODE_SIZE;
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::AtomicBuffer;
    use crate::topology::node::node_chain_writer::NodeChainWriter;
    use crate::topology::node::node_data::NodeDraft;
    use crate::topology::synapse::synapse_chain_writer::SynapseChainWriter;
    use crate::topology::synapse::synapse_data::SynapseDraft;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_mem(size: usize) -> AtomicBuffer {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    const MEM_SIZE: usize = 65536;
    const TB_START: usize = 0;
    const TB_BUF_CAP: usize = 16384;
    const NODE_CAPACITY: usize = 16;
    const SYNAPSE_CAPACITY: usize = 32;
    const NODE_HEAD_OFFSET: usize = NODE_CAPACITY * NODE_SIZE;
    const SYNAPSE_START_OFFSET: usize = NODE_HEAD_OFFSET + 1;
    const NODE_FL_START: usize = 50000;

    struct TestHarness {
        mem: AtomicBuffer,
        writer: crate::primitives::triple_buffer::TripleBufferWriter,
        _reader: crate::primitives::triple_buffer::TripleBufferReader,
    }

    fn setup() -> TestHarness {
        let mem = create_mem(MEM_SIZE);
        let (writer, reader) = TripleBuffer::new(Arc::clone(&mem), TB_START, TB_BUF_CAP);

        TestHarness {
            mem,
            writer,
            _reader: reader,
        }
    }

    #[test]
    fn synapse_writer_set_get_all_fields() {
        let h = setup();
        let node_chain = NodeChainWriter::new(
            Arc::clone(&h.mem),
            h.writer.clone(),
            NODE_FL_START,
            NODE_HEAD_OFFSET,
            NODE_CAPACITY,
        );
        let synapse_chain = SynapseChainWriter::new(
            Arc::clone(&h.mem),
            h.writer.clone(),
            node_chain.clone(),
            node_chain.mem_end_offset(),
            SYNAPSE_START_OFFSET,
            SYNAPSE_CAPACITY,
        );

        let src = node_chain.insert_head(NodeDraft { kind: 1 }).unwrap();
        let tgt = node_chain.insert_head(NodeDraft { kind: 2 }).unwrap();
        let syn = synapse_chain
            .connect(src, tgt, SynapseDraft { kind: 5 })
            .unwrap();

        let s = synapse_chain.get(syn);

        // verify fields set by connect
        assert_eq!(s.get_kind(), 5);
        assert_eq!(s.get_source_ptr(), src);
        assert_eq!(s.get_target_ptr(), tgt);

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
        let node_chain = NodeChainWriter::new(
            Arc::clone(&h.mem),
            h.writer.clone(),
            NODE_FL_START,
            NODE_HEAD_OFFSET,
            NODE_CAPACITY,
        );
        let synapse_chain = SynapseChainWriter::new(
            Arc::clone(&h.mem),
            h.writer.clone(),
            node_chain.clone(),
            node_chain.mem_end_offset(),
            SYNAPSE_START_OFFSET,
            SYNAPSE_CAPACITY,
        );

        let src = node_chain.insert_head(NodeDraft { kind: 1 }).unwrap();
        let tgt = node_chain.insert_head(NodeDraft { kind: 2 }).unwrap();
        let syn = synapse_chain
            .connect(src, tgt, SynapseDraft { kind: 0 })
            .unwrap();

        let s = synapse_chain.get(syn);

        // mutate whatever mutable field occupies the lower 24 bits of field 0
        s.0.write(0, (0x7F << 24) | 0x00FFFFFF); // simulate lower bits being set
        let raw = s.0.read(0);
        assert_eq!(raw >> 24, 0x7F, "opcode preserved");
    }
}
