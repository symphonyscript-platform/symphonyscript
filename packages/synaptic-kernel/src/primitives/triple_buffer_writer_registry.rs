use crate::primitives::triple_buffer_def::{TripleBufferDef, TripleBufferId};
use crate::primitives::triple_buffer_reader_registry::TripleBufferReaderRegistry;
use crate::primitives::triple_buffer_writer::TripleBufferWriter;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

/// Fixed-size registry of `N` triple-buffer writers with user-assigned IDs in [0, N-1] range.
///
/// # ID Semantics
/// IDs form a permutation of `[0, N-1]`. The user assigns each TB an ID in that range,
/// in any order. The registry validates uniqueness and range at construction-time.
/// No gaps, no empty slots.
///
/// # Threading
/// Producer-side only. The consumer uses `TripleBufferReaderRegistry`.
///
/// # Memory Layout
/// `id_index[user_id]` -> position in `tbs`.
/// Two cache-hot array reads per lookup.
#[derive(Clone)]
pub struct TripleBufferWriterRegistry<const N: usize> {
    mem: AtomicBuffer,
    defs: [TripleBufferDef; N],
    mem_start_offset: usize,
    mem_end_offset: usize,
    id_index: [u16; N],
    tbs: [TripleBufferWriter; N],
}

impl<const N: usize> TripleBufferWriterRegistry<N> {
    const _ASSERT_N_FITS_U16_ID: () = assert!(N > 0 && N <= u16::MAX as usize);

    pub fn new(mem: AtomicBuffer, defs: [TripleBufferDef; N], mem_start_offset: usize) -> Self {
        Self::create(mem, defs, mem_start_offset, false)
    }

    pub fn bind(mem: AtomicBuffer, defs: [TripleBufferDef; N], mem_start_offset: usize) -> Self {
        Self::create(mem, defs, mem_start_offset, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        defs: [TripleBufferDef; N],
        mem_start_offset: usize,
        bind: bool,
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
            "TripleBufferWriterRegistry::create | range [{}..{}] out of AtomicBuffer bounds [0; {}]",
            mem_start_offset,
            cursor,
            mem.len(),
        );

        let mut id_index: [u16; N] = [u16::MAX; N];

        for i in 0..N {
            let id = defs[i].id;

            debug_assert!(
                (id.0 as usize) < N,
                "TripleBufferWriterRegistry::create | id {} out of bounds [0-{}]",
                id,
                N - 1,
            );

            debug_assert!(
                id_index[id.0 as usize] == u16::MAX,
                "TripleBufferWriterRegistry::create | duplicate id {}",
                id
            );

            id_index[id.0 as usize] = i as u16;
        }

        let tbs: [TripleBufferWriter; N] = std::array::from_fn(|i| {
            TripleBufferWriter::create(Arc::clone(&mem), offsets[i], defs[i].buffer_capacity, bind)
        });

        let mem_end_offset = tbs[N - 1].mem_end_offset();

        TripleBufferWriterRegistry {
            mem,
            defs,
            mem_start_offset,
            mem_end_offset,
            id_index,
            tbs,
        }
    }

    pub fn calculate_size_on_mem(defs: &[TripleBufferDef; N]) -> usize {
        let mut size: usize = 0;

        for i in 0..N {
            size += TripleBufferWriter::calculate_size_on_mem(defs[i].buffer_capacity)
        }

        size
    }

    pub fn to_reader(&self) -> TripleBufferReaderRegistry<N> {
        TripleBufferReaderRegistry::<N>::bind(
            Arc::clone(&self.mem),
            self.defs,
            self.mem_start_offset,
        )
    }

    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    pub fn get(&self, id: TripleBufferId) -> &TripleBufferWriter {
        debug_assert!(
            (id.0 as usize) < N,
            "TripleBufferWriterRegistry::get | id {} out of bounds [0-{}]",
            id,
            N - 1,
        );

        let index = self.id_index[id.0 as usize];
        &self.tbs[index as usize]
    }
}
