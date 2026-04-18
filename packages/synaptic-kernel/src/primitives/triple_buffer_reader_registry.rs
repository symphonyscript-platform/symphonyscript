use crate::primitives::triple_buffer_def::{TripleBufferDef, TripleBufferId};
use crate::primitives::triple_buffer_reader::TripleBufferReader;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

/// Fixed-size registry of `N` triple-buffer readers with user-assigned IDs in [0, N-1] range.
///
/// # ID Semantics
/// IDs form a permutation of `[0, N-1]`. The user assigns each TB an ID in that range,
/// in any order. The registry validates uniqueness and range at construction-time.
/// No gaps, no empty slots.
///
/// # Threading
/// Consumer-side only. The producer uses `TripleBufferWriterRegistry`.
///
/// # Memory Layout
/// `id_index[user_id]` -> position in `tbs`.
/// Two cache-hot array reads per lookup.
#[derive(Clone)]
pub struct TripleBufferReaderRegistry<const N: usize> {
    id_index: [u16; N],
    tbs: [TripleBufferReader; N],
    mem_start_offset: usize,
    mem_end_offset: usize,
}

impl<const N: usize> TripleBufferReaderRegistry<N> {
    const _ASSERT_N_FITS_U16_ID: () = assert!(N > 0 && N <= u16::MAX as usize);

    pub(crate) fn bind(
        mem: AtomicBuffer,
        defs: [TripleBufferDef; N],
        mem_start_offset: usize,
    ) -> Self {
        const { assert!(N > 0 && N <= u16::MAX as usize) };

        let mut offsets: [usize; N] = [0; N];
        let mut cursor = mem_start_offset;

        for i in 0..N {
            offsets[i] = cursor;
            cursor += TripleBufferWriter::calculate_size_on_mem(defs[i].buffer_capacity);
        }

        debug_assert!(
            cursor <= mem.len(),
            "TripleBufferReaderRegistry::bind | range [{}..{}] out of AtomicBuffer bounds [0; {}]",
            mem_start_offset,
            cursor,
            mem.len(),
        );

        let mut id_index: [u16; N] = [u16::MAX; N];

        for i in 0..N {
            let id = defs[i].id;

            debug_assert!(
                (id.0 as usize) < N,
                "TripleBufferReaderRegistry::bind | id {} out of bounds [0-{}]",
                id,
                N - 1,
            );

            debug_assert!(
                id_index[id.0 as usize] == u16::MAX,
                "TripleBufferReaderRegistry::bind | duplicate id {}",
                id
            );

            id_index[id.0 as usize] = i as u16;
        }

        let tbs: [TripleBufferReader; N] = std::array::from_fn(|i| {
            TripleBufferReader::bind(Arc::clone(&mem), offsets[i], defs[i].buffer_capacity)
        });

        let mem_end_offset = tbs[N - 1].mem_end_offset();

        TripleBufferReaderRegistry {
            id_index,
            tbs,
            mem_start_offset,
            mem_end_offset,
        }
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&self, id: TripleBufferId) -> &TripleBufferReader {
        debug_assert!(
            (id.0 as usize) < N,
            "TripleBufferReaderRegistry::get | id {} out of bounds [0-{}]",
            id,
            N - 1,
        );

        let index = self.id_index[id.0 as usize];
        &self.tbs[index as usize]
    }
}
