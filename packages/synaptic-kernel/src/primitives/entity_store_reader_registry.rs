use crate::primitives::entry_store_def::EntryStoreDef;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::primitives::triple_buffer_def::TripleBufferId;
use crate::primitives::triple_buffer_reader_registry::TripleBufferReaderRegistry;
use crate::primitives::types::AtomicBuffer;

/// Fixed-size registry of `N` Entry-store Readers with user-assigned IDs in [0, N-1] range.
///
/// # ID Semantics
/// IDs form a permutation of `[0, N-1]`. The user assigns each TB an ID in that range,
/// in any order. The registry validates uniqueness and range at construction-time.
/// No gaps, no empty slots.
///
/// # Threading
/// Consumer-side only. The producer uses `EntryStoreWriterRegistry`.
#[derive(Clone)]
pub struct EntryStoreReaderRegistry<const TB_COUNT: usize, const STORE_COUNT: usize> {
    mem: AtomicBuffer,
    tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    id_index: [u16; STORE_COUNT],
    offsets: [usize; STORE_COUNT],
    stores: [EntryStoreReader; STORE_COUNT],
}

impl<const TB_COUNT: usize, const STORE_COUNT: usize>
    EntryStoreReaderRegistry<TB_COUNT, STORE_COUNT>
{
    const _ASSERT_N_FITS_U16_ID: () = assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize);

    pub fn new(
        mem: AtomicBuffer,
        tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
        id_index: [u16; STORE_COUNT],
        offsets: [usize; STORE_COUNT],
        stores: [EntryStoreReader; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
    ) -> Self {
        Self::create(
            mem,
            tb_registry,
            id_index,
            offsets,
            stores,
            mem_start_offset,
            mem_end_offset,
            false,
        )
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
        id_index: [u16; STORE_COUNT],
        offsets: [usize; STORE_COUNT],
        stores: [EntryStoreReader; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
    ) -> Self {
        Self::create(
            mem,
            tb_registry,
            id_index,
            offsets,
            stores,
            mem_start_offset,
            mem_end_offset,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
        id_index: [u16; STORE_COUNT],
        offsets: [usize; STORE_COUNT],
        stores: [EntryStoreReader; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
        _bind: bool,
    ) -> Self {
        const { assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize) };

        EntryStoreReaderRegistry {
            mem,
            tb_registry,
            mem_start_offset,
            mem_end_offset,
            id_index,
            offsets,
            stores,
        }
    }

    #[inline]
    pub fn calculate_size_on_mem(defs: &[EntryStoreDef; STORE_COUNT]) -> usize {
        Self::calculate_size_on_mem(defs)
    }

    #[inline]
    pub fn mem_start_offset(&self) -> usize {
        self.mem_start_offset
    }

    #[inline]
    pub fn mem_end_offset(&self) -> usize {
        self.mem_end_offset
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.mem_end_offset - self.mem_start_offset
    }

    #[inline]
    pub fn get(&self, id: TripleBufferId) -> &EntryStoreReader {
        debug_assert!(
            (id.0 as usize) < STORE_COUNT || id.0 == TripleBufferId::DEFAULT.0,
            "EntryStoreReaderRegistry::get | id {} out of bounds [0-{}]",
            id,
            STORE_COUNT - 1,
        );

        let index = self.id_index[id.0 as usize];
        &self.stores[index as usize]
    }
}
