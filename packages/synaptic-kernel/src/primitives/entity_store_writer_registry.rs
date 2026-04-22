use crate::primitives::entity_store_reader_registry::EntryStoreReaderRegistry;
use crate::primitives::entry_store_def::EntryStoreDef;
use crate::primitives::entry_store_writer::EntryStoreWriter;
use crate::primitives::slot_allocator::SlotAllocator;
use crate::primitives::triple_buffer_def::TripleBufferId;
use crate::primitives::triple_buffer_writer_registry::TripleBufferWriterRegistry;
use crate::primitives::types::AtomicBuffer;
use std::sync::Arc;

/// Fixed-size registry of `N` Entry-store writers with user-assigned IDs in [0, N-1] range.
///
/// # ID Semantics
/// IDs form a permutation of `[0, N-1]`. The user assigns each TB an ID in that range,
/// in any order. The registry validates uniqueness and range at construction-time.
/// No gaps, no empty slots.
///
/// # Threading
/// Producer-side only. The consumer uses `EntryStoreReaderRegistry`.
#[derive(Clone)]
pub struct EntryStoreWriterRegistry<const TB_COUNT: usize, const STORE_COUNT: usize> {
    mem: AtomicBuffer,
    tb_registry: TripleBufferWriterRegistry<TB_COUNT>,
    mem_start_offset: usize,
    mem_end_offset: usize,
    id_index: [u16; STORE_COUNT],
    offsets: [usize; STORE_COUNT],
    defs: [EntryStoreDef; STORE_COUNT],
}

impl<const TB_COUNT: usize, const STORE_COUNT: usize>
    EntryStoreWriterRegistry<TB_COUNT, STORE_COUNT>
{
    const _ASSERT_N_FITS_U16_ID: () = assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize);

    pub fn new(
        mem: AtomicBuffer,
        tb_registry: TripleBufferWriterRegistry<TB_COUNT>,
        defs: [EntryStoreDef; STORE_COUNT],
        mem_start_offset: usize,
    ) -> Self {
        Self::create(mem, tb_registry, defs, mem_start_offset, false)
    }

    pub fn bind(
        mem: AtomicBuffer,
        tb_registry: TripleBufferWriterRegistry<TB_COUNT>,
        defs: [EntryStoreDef; STORE_COUNT],
        mem_start_offset: usize,
    ) -> Self {
        Self::create(mem, tb_registry, defs, mem_start_offset, true)
    }

    pub fn create(
        mem: AtomicBuffer,
        tb_registry: TripleBufferWriterRegistry<TB_COUNT>,
        defs: [EntryStoreDef; STORE_COUNT],
        mem_start_offset: usize,
        _bind: bool,
    ) -> Self {
        const { assert!(STORE_COUNT > 0 && STORE_COUNT < u16::MAX as usize) };

        let mut offsets: [usize; STORE_COUNT] = [0; STORE_COUNT];
        let mut cursor = 0;

        for i in 0..STORE_COUNT {
            offsets[i] = cursor;
            let capacity = defs[i].capacity;
            cursor +=
                SlotAllocator::calculate_size_on_mem(capacity) + capacity * defs[i].attr_stride;
        }

        debug_assert!(
            cursor <= mem.len(),
            "EntryStoreWriterRegistry::create | range [{}..{}] out of AtomicBuffer bounds [0; {}]",
            mem_start_offset,
            cursor,
            mem.len(),
        );

        let mut id_index: [u16; STORE_COUNT] = [u16::MAX; STORE_COUNT];

        for i in 0..STORE_COUNT {
            let id = defs[i].id;

            debug_assert!(
                (id.0 as usize) < STORE_COUNT,
                "EntryStoreWriterRegistry::create | id {} out of bounds [0-{}]",
                id,
                STORE_COUNT - 1,
            );

            debug_assert!(
                id_index[id.0 as usize] == u16::MAX,
                "EntryStoreWriterRegistry::create | duplicate id {}",
                id
            );

            id_index[id.0 as usize] = i as u16;
        }

        EntryStoreWriterRegistry {
            mem,
            tb_registry,
            mem_start_offset,
            mem_end_offset: cursor,
            id_index,
            offsets,
            defs,
        }
    }

    pub fn calculate_size_on_mem(defs: &[EntryStoreDef; STORE_COUNT]) -> usize {
        let mut size: usize = 0;

        for i in 0..STORE_COUNT {
            size += Self::calculate_def_size_on_mem(&defs[i])
        }

        size
    }

    pub fn calculate_def_size_on_mem(def: &EntryStoreDef) -> usize {
        SlotAllocator::calculate_size_on_mem(def.capacity) + def.capacity * def.attr_stride
    }

    pub fn to_reader(&self) -> EntryStoreReaderRegistry<TB_COUNT, STORE_COUNT> {
        EntryStoreReaderRegistry::<TB_COUNT, STORE_COUNT>::bind(
            Arc::clone(&self.mem),
            self.tb_registry.to_reader(),
            self.id_index,
            self.offsets,
            self.defs,
            self.mem_start_offset,
            self.mem_end_offset,
        )
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
    ) -> EntryStoreWriter<CORE_STRIDE, META_STRIDE, ATTR_STRIDE> {
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

        EntryStoreWriter::bind(
            Arc::clone(&self.mem),
            self.tb_registry.get(def.tb_id).clone(),
            self.offsets[index] as usize,
            0,
            def.capacity,
        )
    }
}
