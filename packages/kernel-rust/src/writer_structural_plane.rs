use crate::primitives::simple_free_list::SimpleFreeList;
use crate::primitives::triple_buffer::TripleBufferWriter;

pub struct WriterStructuralPlane {
    writer: TripleBufferWriter,
    free_list: SimpleFreeList,
}

impl WriterStructuralPlane {
    pub fn new(writer: TripleBufferWriter, free_list: SimpleFreeList) -> Self {
        WriterStructuralPlane { writer, free_list }
    }


}
