use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct SlotWriter<'a, const SLOT_SIZE: usize> {
    pub(crate) writer: &'a TripleBufferWriter,
    pub(crate) start_offset: usize,
}

impl<'a, const SLOT_SIZE: usize> SlotWriter<'a, SLOT_SIZE> {
    pub fn new(writer: &'a TripleBufferWriter, start_offset: usize) -> Self {
        let end_index = start_offset + SLOT_SIZE;
        debug_assert!(
            end_index <= writer.buffer_capacity(),
            "SlotWriter out of bounds"
        );
        SlotWriter {
            writer: &writer,
            start_offset,
        }
    }

    pub fn read(&self, offset: usize) -> i32 {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        self.writer.read(self.start_offset + offset)
    }

    pub(crate) fn write(&self, offset: usize, value: i32) {
        debug_assert!(offset < SLOT_SIZE, "offset out of bounds");
        self.writer.write(self.start_offset + offset, value)
    }
}

#[cfg(test)]
mod tests {
    use crate::primitives::triple_buffer::TripleBuffer;
    use crate::primitives::types::SAB;
    use crate::structural_plane::slot_writer::SlotWriter;
    use std::sync::atomic::AtomicI32;
    use std::sync::Arc;

    fn create_sab(size: usize) -> SAB {
        let mut vec = Vec::with_capacity(size);
        for _ in 0..size {
            vec.push(AtomicI32::new(0));
        }
        Arc::new(vec)
    }

    #[test]
    fn write_then_read_round_trip() {
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, 42);
        assert_eq!(view.read(0), 42);
    }

    #[test]
    fn write_all_slots() {
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
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
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, i32::MAX);
        assert_eq!(view.read(1), 0);
        assert_eq!(view.read(15), 0);
    }

    #[test]
    fn overwrite_replaces_value() {
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, 100);
        view.write(0, 200);
        assert_eq!(view.read(0), 200);
    }

    #[test]
    fn two_views_different_offsets_are_independent() {
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
        let view_a: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);
        let view_b: SlotWriter<'_, 16> = SlotWriter::new(&writer, 16);

        view_a.write(0, 111);
        view_b.write(0, 222);

        assert_eq!(view_a.read(0), 111);
        assert_eq!(view_b.read(0), 222);
    }

    #[test]
    fn negative_values_preserved() {
        let sab = create_sab(1024);
        let (writer, _reader) = TripleBuffer::new(sab, 0, 256);
        let view: SlotWriter<'_, 16> = SlotWriter::new(&writer, 0);

        view.write(0, -999);
        view.write(1, i32::MIN);
        assert_eq!(view.read(0), -999);
        assert_eq!(view.read(1), i32::MIN);
    }
}
