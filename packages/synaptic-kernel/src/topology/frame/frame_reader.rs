use crate::topology::slot_reader::SlotReader;

pub struct FrameReader<'a, const FRAME_SIZE: usize>(SlotReader<'a, FRAME_SIZE>);

impl<'a, const FRAME_SIZE: usize> FrameReader<'a, FRAME_SIZE> {
    pub fn new(slot: SlotReader<'a, FRAME_SIZE>) -> Self {
        FrameReader(slot)
    }

    pub fn get(&self, offset: usize) -> i32 {
        self.0.read(offset)
    }
}
