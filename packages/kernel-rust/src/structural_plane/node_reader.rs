use crate::structural_plane::node_writer::NodeWriter;
use crate::structural_plane::slot_reader::SlotReader;

pub struct NodeReader<'a>(pub SlotReader<'a, { NodeWriter::SLOT_SIZE }>);

impl<'a> NodeReader<'a> {
    pub fn get_opcode(&self) -> i32 {
        self.0.read(0) >> 24
    }

    pub fn get_base_tick(&self) -> i32 {
        self.0.read(1)
    }

    pub fn get_next_ptr(&self) -> i32 {
        self.0.read(2)
    }

    pub fn get_prev_ptr(&self) -> i32 {
        self.0.read(3)
    }

    pub fn get_synapse_list_head(&self) -> i32 {
        self.0.read(4)
    }

    pub fn get_reverse_synapse_head(&self) -> i32 {
        self.0.read(5)
    }

    pub fn get_mod_list_head(&self) -> i32 {
        self.0.read(6)
    }
}
