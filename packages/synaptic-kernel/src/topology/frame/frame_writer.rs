use crate::topology::slot_writer::SlotWriter;

pub struct FrameWriter<'a, const FRAME_SIZE: usize>(SlotWriter<'a, FRAME_SIZE>);

impl<'a, const FRAME_SIZE: usize> FrameWriter<'a, FRAME_SIZE> {
    pub fn new(slot: SlotWriter<'a, FRAME_SIZE>) -> Self {
        FrameWriter(slot)
    }

    pub fn get(&self, offset: usize) -> i32 {
        self.0.read(offset)
    }

    pub fn set(&self, offset: usize, value: i32) {
        self.0.write(offset, value)
    }
}
