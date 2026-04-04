use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct  SlotWriter<'a, const SLOT_SIZE: usize> {
    pub(crate) writer: &'a TripleBufferWriter,
    pub(crate) tb_start_offset: usize,
    pub(crate) tb_end_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotWriter<'a, SLOT_SIZE> {
    pub fn new(writer: &'a TripleBufferWriter, tb_start_offset: usize) -> Self {
        let tb_end_offset = tb_start_offset + SLOT_SIZE;
        debug_assert!(
            tb_end_offset <= writer.buffer_capacity(),
            "SlotWriter::create | range [{}..{}] exceeds buffer capacity {}",
            tb_start_offset,
            SLOT_SIZE,
            writer.buffer_capacity(),
        );
        SlotWriter {
            writer: &writer,
            tb_start_offset,
            tb_end_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotWriter.read | offset {} out of bounds",
            offset
        );
        self.writer.read(self.tb_start_offset + offset)
    }

    pub(crate) fn write(&self, offset: usize, value: i32) {
        debug_assert!(
            offset < SLOT_SIZE,
            "SlotWriter.write | offset {} out of bounds",
            offset
        );
        self.writer
            .write(self.tb_start_offset + offset, value)
    }

    pub fn tb_start_offset(&self) -> usize {
        self.tb_start_offset
    }

    pub fn tb_end_offset(&self) -> usize {
        self.tb_end_offset
    }
}

#[cfg(test)]
mod tests {
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::AtomicBuffer;
    use crate::structural_plane::slot_writer::SlotWriter;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_mem(size: usize) -> AtomicBuffer {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    #[test]
    fn write_then_read_round_trip() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, 42);
        assert_eq!(view.read(0), 42);
    }

    #[test]
    fn write_all_slots() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        for i in 0..16 {
            view.write(i, (i as i32) * 100);
        }

        for i in 0..16 {
            assert_eq!(view.read(i), (i as i32) * 100);
        }
    }

    #[test]
    fn fields_do_not_bleed() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, i32::MAX);
        assert_eq!(view.read(1), 0);
        assert_eq!(view.read(15), 0);
    }

    #[test]
    fn overwrite_replaces_value() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, 100);
        view.write(0, 200);
        assert_eq!(view.read(0), 200);
    }

    #[test]
    fn two_views_different_offsets_are_independent() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view_a: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);
        let view_b: SlotWriter<'_, 16> = SlotWriter::new(&writer, 16);

        view_a.write(0, 111);
        view_b.write(0, 222);

        assert_eq!(view_a.read(0), 111);
        assert_eq!(view_b.read(0), 222);
    }

    #[test]
    fn negative_values_preserved() {
        let mem = create_mem(1024);
        let (writer, _reader) = TripleBuffer::new(mem, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, -999);
        view.write(1, i32::MIN);
        assert_eq!(view.read(0), -999);
        assert_eq!(view.read(1), i32::MIN);
    }
}
