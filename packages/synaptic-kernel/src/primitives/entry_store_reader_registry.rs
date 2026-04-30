use crate::primitives::entry_store_def::EntryStoreId;
use crate::primitives::entry_store_reader::EntryStoreReader;

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
pub struct EntryStoreReaderRegistry<const STORE_COUNT: usize> {
    mem_start_offset: usize,
    mem_end_offset: usize,
    id_index: [u16; STORE_COUNT],
    stores: [EntryStoreReader; STORE_COUNT],
}

impl<const STORE_COUNT: usize> EntryStoreReaderRegistry<STORE_COUNT> {
    pub fn bind(
        id_index: [u16; STORE_COUNT],
        stores: [EntryStoreReader; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
    ) -> Self {
        const { assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize) };

        EntryStoreReaderRegistry {
            mem_start_offset,
            mem_end_offset,
            id_index,
            stores,
        }
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
    pub fn get(&self, id: EntryStoreId) -> &EntryStoreReader {
        debug_assert!(
            (id.0 as usize) < STORE_COUNT,
            "EntryStoreReaderRegistry::get | id {} out of bounds [0-{}]",
            id,
            STORE_COUNT - 1,
        );

        let index = self.id_index[id.0 as usize];
        &self.stores[index as usize]
    }
}
