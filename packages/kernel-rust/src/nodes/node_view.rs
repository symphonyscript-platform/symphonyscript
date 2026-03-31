use crate::primitives::types::SAB;
use std::sync::atomic::Ordering;
use crate::primitives::into_array::IntoArray;

pub struct NodeData {
    pub opcode: i32,
    pub base_tick: i32,
    pub next_ptr: i32,
    pub prev_ptr: i32,
    pub synapse_list_head: i32,
    pub reverse_synapse_head: i32,
    pub mod_list_head: i32,
    // +4 bytes reserved
}

impl IntoArray<8> for NodeData {
    fn to_array(&self) -> [i32; 8] {
        let mut data = [0; 8];

        data[0] = self.opcode;
        data[1] = self.base_tick;
        data[2] = self.next_ptr;
        data[3] = self.prev_ptr;
        data[4] = self.synapse_list_head;
        data[5] = self.reverse_synapse_head;
        data[6] = self.mod_list_head;

        data
    }
}

pub struct NodeView<'a> {
    pub(crate) sab: &'a SAB,
    pub(crate) start_index: usize,
}

impl<'a> NodeView<'a> {
    pub const SLOT_SIZE: usize = 8;
    pub const OPCODE_NOTE: i32 = 0x01;
    pub const OPCODE_REST: i32 = 0x02;
    pub const OPCODE_BARRIER: i32 = 0x03;
    pub const OPCODE_CONTROL: i32 = 0x04; // 0-127 - MIDI, 128 - BEND, 129 Channel Pressure (Aftertouch), 130+ - custom
    pub const OPCODE_BOUNDARY: i32 = 0x05;
    pub const OPCODE_SEED: i32 = 0x06;
    pub const OPCODE_LUT: i32 = 0x07;

    pub fn new(sab: &'a SAB, start_index: usize) -> Self {
        let end_index = start_index + Self::SLOT_SIZE;
        debug_assert!(end_index < sab.len(), "NodeView out of bounds");
        NodeView {
            sab: &sab,
            start_index,
        }
    }

    pub fn resolve_sab_index(start_index: usize, offset: usize) -> usize {
        start_index + (offset * NodeView::SLOT_SIZE)
    }

    pub fn get_opcode(&self) -> i32 {
        self.read(0) >> 24
    }

    pub fn set_pitch(&self, value: i32) {
        self.write(0, value)
    }

    pub fn velocity(&self) -> i32 {
        self.read(1)
    }

    pub fn set_velocity(&self, value: i32) {
        self.write(1, value)
    }

    pub fn duration(&self) -> i32 {
        self.read(2)
    }

    pub fn set_duration(&self, value: i32) {
        self.write(2, value)
    }

    pub fn volume(&self) -> i32 {
        self.read(3)
    }

    pub fn set_volume(&self, value: i32) {
        self.write(3, value)
    }

    pub fn spatial_x(&self) -> i32 {
        self.read(4)
    }

    pub fn set_spatial_x(&self, value: i32) {
        self.write(4, value)
    }

    pub fn spatial_y(&self) -> i32 {
        self.read(5)
    }

    pub fn set_spatial_y(&self, value: i32) {
        self.write(5, value)
    }

    pub fn spatial_z(&self) -> i32 {
        self.read(6)
    }

    pub fn set_spatial_z(&self, value: i32) {
        self.write(6, value)
    }

    pub fn detune(&self) -> i32 {
        self.read(7)
    }

    pub fn set_detune(&self, value: i32) {
        self.write(7, value)
    }

    pub fn tick_offset(&self) -> i32 {
        self.read(8)
    }

    pub fn set_tick_offset(&self, value: i32) {
        self.write(8, value)
    }

    pub fn flags(&self) -> u32 {
        self.read(9) as u32
    }

    pub fn set_flags(&self, value: u32) {
        self.write(9, value as i32)
    }

    fn read(&self, index: usize) -> i32 {
        self.sab[self.start_index + index].load(Ordering::Relaxed)
    }

    fn write(&self, index: usize, value: i32) {
        self.sab[self.start_index + index].store(value, Ordering::Relaxed)
    }
}
