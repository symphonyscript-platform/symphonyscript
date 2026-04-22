use crate::primitives::entry_store_Reader::EntryStoreReader;
use crate::primitives::entry_store_def::EntryStoreDef;
use crate::primitives::entry_store_reader::EntryStoreReader;
use crate::primitives::triple_buffer_Reader_registry::TripleBufferReaderRegistry;
use crate::primitives::triple_buffer_def::TripleBufferId;
use crate::primitives::triple_buffer_reader_registry::TripleBufferReaderRegistry;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

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
    offsets: [u16; STORE_COUNT],
    defs: [EntryStoreDef; STORE_COUNT],
}

impl<const TB_COUNT: usize, const STORE_COUNT: usize>
    EntryStoreReaderRegistry<TB_COUNT, STORE_COUNT>
{
    const _ASSERT_N_FITS_U16_ID: () = assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize);

    pub fn new(
        mem: AtomicBuffer,
        tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
        id_index: [u16; STORE_COUNT],
        offsets: [u16; STORE_COUNT],
        defs: [EntryStoreDef; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
    ) -> Self {
        Self::create(
            mem,
            tb_registry,
            id_index,
            offsets,
            defs,
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
        defs: [EntryStoreDef; STORE_COUNT],
        mem_start_offset: usize,
        mem_end_offset: usize,
    ) -> Self {
        Self::create(
            mem,
            tb_registry,
            id_index,
            offsets,
            defs,
            mem_start_offset,
            mem_end_offset,
            true,
        )
    }

    pub fn create(
        mem: AtomicBuffer,
        tb_registry: TripleBufferReaderRegistry<TB_COUNT>,
        id_index: [u16; STORE_COUNT],
        offsets: [u16; STORE_COUNT],
        defs: [EntryStoreDef; STORE_COUNT],
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
            defs,
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
    pub fn mount_entry_store<
        const CORE_STRIDE: usize,
        const META_STRIDE: usize,
        const ATTR_STRIDE: usize,
    >(
        &self,
        id: TripleBufferId,
    ) -> EntryStoreReader<CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
        debug_assert!(
            (id.0 as usize) < STORE_COUNT,
            "Kernel::mount_entry_store | id {} out of bounds [0-{}]",
            id,
            STORE_COUNT - 1,
        );

        let index = self.id_index[id.0 as usize] as usize;
        let def = self.defs[index];

        debug_assert_eq!(
            CORE_STRIDE, def.core_stride,
            "const-generic CORE_STRIDE {} does not match definition's core_stride {}",
            CORE_STRIDE, def.core_stride
        );

        debug_assert_eq!(
            META_STRIDE, def.meta_stride,
            "const-generic META_STRIDE {} does not match definition's meta_stride {}",
            META_STRIDE, def.meta_stride
        );

        debug_assert_eq!(
            ATTR_STRIDE, def.attr_stride,
            "const-generic ATTR_STRIDE {} does not match definition's attr_stride {}",
            ATTR_STRIDE, def.attr_stride
        );

        EntryStoreReader::bind(
            Arc::clone(&self.mem),
            self.tb_registry.get(def.tb_id).clone(),
            self.offsets[index] as usize,
            0,
            def.capacity,
        )
    }
}
