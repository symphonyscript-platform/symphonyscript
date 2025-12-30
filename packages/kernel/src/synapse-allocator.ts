// =============================================================================
// SymphonyScript - Synapse Allocator (RFC-045)
// =============================================================================

import {
  HDR,
  SYNAPSE,
  SYN_PACK,
  SYNAPSE_TABLE,
  NULL_PTR,
  getSynapseTableOffset,
  SYNAPSE_ERR,
  KNUTH_HASH_CONST,
  REVERSE_INDEX,
  getReverseIndexOffset,
  ERROR
} from './constants'
import type { SynapsePtr } from './types'
import { SynapseView } from './synapse-view'

/**
 * Synapse Allocator - The "Dendrite" Manager for the Silicon Brain.
 *
 * Extends SynapseView with Write capabilities.
 * Manages the 1MB Synapse Table in the SharedArrayBuffer.
 *
 * **K-001 Class Separation & Optimization:**
 * - Extends implementation-free `SynapseView` (Base)
 * - Owns write buffers (staging arrays)
 * - **Lazy Allocation:** Staging arrays are only allocated when compaction occurs.
 *   This saves ~0.75MB of memory for read-only consumers (like SiliconBridge in default mode).
 */
export class SynapseAllocator extends SynapseView {
  /** Pre-allocated staging array for compaction - source pointers (Lazy) */
  private stagingSourcePtrs: Int32Array | null = null

  /** Pre-allocated staging array for compaction - target pointers (Lazy) */
  private stagingTargetPtrs: Int32Array | null = null

  /** Pre-allocated staging array for compaction - weight data (Lazy) */
  private stagingWeightData: Int32Array | null = null

  constructor(buffer: SharedArrayBuffer) {
    super(buffer)
    // K-001: Lazy allocation. Do not allocate staging arrays here.
  }

  /**
   * Reset allocator state after table clear.
   */
  clear(): void {
    this.usedSlots = 0
    this.tombstoneCount = 0
  }

  /**
    * Create a synaptic connection between two Axons.
    *
    * @param sourcePtr - The Trigger Node (End of Clip)
    * @param targetPtr - The Destination Node (Start of Next Clip)
    * @param weight - Probability/Intensity (0-1000)
    * @param jitter - Micro-timing deviation in ticks (0-65535)
    * @returns The SynapsePtr to the new entry on success, or negative error code
    */
  connect(sourcePtr: number, targetPtr: number, weight: number, jitter: number): SynapsePtr {
    if (sourcePtr === NULL_PTR || targetPtr === NULL_PTR) {
      return SYNAPSE_ERR.INVALID_PTR
    }

    const weightData =
      ((weight & SYN_PACK.WEIGHT_MASK) << SYN_PACK.WEIGHT_SHIFT) |
      ((jitter & SYN_PACK.JITTER_MASK) << SYN_PACK.JITTER_SHIFT)

    const headSlot = this.findHeadSlot(sourcePtr)
    let entrySlot = -1
    let tailSlot = -1
    let tailOffset = -1

    if (headSlot === -1) {
      // Find fresh empty slot
      const idealSlot = this.hash(sourcePtr)
      entrySlot = this.findEmptySlot(idealSlot)
      if (entrySlot === -1) return SYNAPSE_ERR.TABLE_FULL
    } else {
      // Append to chain
      entrySlot = this.findEmptySlot(headSlot + 1)
      if (entrySlot === -1) return SYNAPSE_ERR.TABLE_FULL

      tailSlot = headSlot
      let nextPtr = this.getNextPtr(tailSlot)
      let ops = 0
      while (nextPtr !== NULL_PTR) {
        tailSlot = this.slotFromPtr(nextPtr)
        nextPtr = this.getNextPtr(tailSlot)
        ops++
        if (ops > 1000) return SYNAPSE_ERR.CHAIN_LOOP
      }
      tailOffset = this.offsetForSlot(tailSlot)
    }

    const entryOffset = this.offsetForSlot(entrySlot)

    // Write data
    Atomics.store(this.sab, entryOffset + SYNAPSE.TARGET_PTR, targetPtr)
    Atomics.store(this.sab, entryOffset + SYNAPSE.WEIGHT_DATA, weightData)
    Atomics.store(this.sab, entryOffset + SYNAPSE.META_NEXT, 0)
    Atomics.store(this.sab, entryOffset + SYNAPSE.SOURCE_PTR, sourcePtr)

    // Reverse Index
    const bucketIdx = ((targetPtr * KNUTH_HASH_CONST) >>> 0) & REVERSE_INDEX.BUCKET_MASK
    const bucketOffset = this.reverseIndexI32 + bucketIdx
    const currentHead = Atomics.load(this.sab, bucketOffset)
    Atomics.store(this.sab, entryOffset + SYNAPSE.NEXT_SAME_TARGET, currentHead)
    Atomics.store(this.sab, bucketOffset, entrySlot)

    // Link
    if (tailSlot !== -1) {
      const entryPtr = this.ptrFromSlot(entrySlot)
      const currentMeta = Atomics.load(this.sab, tailOffset + SYNAPSE.META_NEXT)
      const plasticity = currentMeta & SYN_PACK.PLASTICITY_MASK
      const newMeta = plasticity | ((entryPtr & SYN_PACK.NEXT_PTR_MASK) << SYN_PACK.NEXT_PTR_SHIFT)
      Atomics.store(this.sab, tailOffset + SYNAPSE.META_NEXT, newMeta)
    }

    this.usedSlots++
    return this.ptrFromSlot(entrySlot)
  }

  /**
   * Sever a synaptic connection.
   */
  disconnect(sourcePtr: number, targetPtr?: number): void {
    const headSlot = this.findHeadSlot(sourcePtr)
    if (headSlot === -1) return

    let currentSlot = headSlot
    let ops = 0

    while (currentSlot !== -1) {
      const offset = this.offsetForSlot(currentSlot)
      const currentTarget = Atomics.load(this.sab, offset + SYNAPSE.TARGET_PTR)

      if (currentTarget !== NULL_PTR && (targetPtr === undefined || currentTarget === targetPtr)) {
        Atomics.store(this.sab, offset + SYNAPSE.TARGET_PTR, NULL_PTR)
        this.tombstoneCount++
        if (targetPtr !== undefined) return
      }

      const nextPtr = this.getNextPtr(currentSlot)
      currentSlot = nextPtr === NULL_PTR ? -1 : this.slotFromPtr(nextPtr)
      ops++
      if (ops > 1000) break
    }
  }

  /**
   * Check if compaction is needed and perform if so.
   */
  maybeCompact(): number {
    if (this.usedSlots < SYNAPSE_TABLE.COMPACTION_MIN_SLOTS) return 0
    if (this.getTombstoneRatio() < SYNAPSE_TABLE.COMPACTION_THRESHOLD) return 0
    return this.compactTable()
  }

  /**
   * Compact the synapse table by rehashing all live entries.
   */
  compactTable(): number {
    // K-001 Lazy Allocation Check
    if (this.stagingSourcePtrs === null) {
      this.stagingSourcePtrs = new Int32Array(SYNAPSE_TABLE.MAX_CAPACITY)
      this.stagingTargetPtrs = new Int32Array(SYNAPSE_TABLE.MAX_CAPACITY)
      this.stagingWeightData = new Int32Array(SYNAPSE_TABLE.MAX_CAPACITY)
    }

    // Capture non-null references for type safety
    const stagingSource = this.stagingSourcePtrs!
    const stagingTarget = this.stagingTargetPtrs!
    const stagingWeight = this.stagingWeightData!

    // Phase 1: Scan
    let liveCount = 0
    let scanSlot = 0

    while (scanSlot < SYNAPSE_TABLE.MAX_CAPACITY) {
      const offset = this.tableOffsetI32 + scanSlot * SYNAPSE_TABLE.STRIDE_I32
      const sourcePtr = Atomics.load(this.sab, offset + SYNAPSE.SOURCE_PTR)
      const targetPtr = Atomics.load(this.sab, offset + SYNAPSE.TARGET_PTR)

      if (sourcePtr !== NULL_PTR && targetPtr !== NULL_PTR) {
        const weightData = Atomics.load(this.sab, offset + SYNAPSE.WEIGHT_DATA)
        stagingSource[liveCount] = sourcePtr
        stagingTarget[liveCount] = targetPtr
        stagingWeight[liveCount] = weightData
        liveCount++
      }
      scanSlot++
    }

    // Phase 2: Clear Table
    let clearSlot = 0
    while (clearSlot < SYNAPSE_TABLE.MAX_CAPACITY) {
      const offset = this.tableOffsetI32 + clearSlot * SYNAPSE_TABLE.STRIDE_I32
      Atomics.store(this.sab, offset + SYNAPSE.SOURCE_PTR, NULL_PTR)
      Atomics.store(this.sab, offset + SYNAPSE.TARGET_PTR, NULL_PTR)
      Atomics.store(this.sab, offset + SYNAPSE.WEIGHT_DATA, 0)
      Atomics.store(this.sab, offset + SYNAPSE.META_NEXT, 0)
      Atomics.store(this.sab, offset + SYNAPSE.NEXT_SAME_TARGET, REVERSE_INDEX.EMPTY)
      clearSlot++
    }

    // Phase 3: Clear Reverse Index
    let bucket = 0
    while (bucket < REVERSE_INDEX.BUCKET_COUNT) {
      Atomics.store(this.sab, this.reverseIndexI32 + bucket, REVERSE_INDEX.EMPTY)
      bucket++
    }

    // Phase 4: Reinsert
    this.usedSlots = 0
    this.tombstoneCount = 0

    let reinsertIdx = 0
    while (reinsertIdx < liveCount) {
      this._insertDirect(
        stagingSource[reinsertIdx],
        stagingTarget[reinsertIdx],
        stagingWeight[reinsertIdx]
      )
      reinsertIdx++
    }

    return liveCount
  }

  /**
   * Direct insertion during compaction (bypasses validation).
   * @internal
   */
  private _insertDirect(sourcePtr: number, targetPtr: number, weightData: number): void {
    const idealSlot = this.hash(sourcePtr)
    let slot = idealSlot
    let probes = 0

    while (probes < SYNAPSE_TABLE.MAX_CAPACITY) {
      const offset = this.tableOffsetI32 + slot * SYNAPSE_TABLE.STRIDE_I32
      const existing = Atomics.load(this.sab, offset + SYNAPSE.SOURCE_PTR)

      if (existing === NULL_PTR) {
        Atomics.store(this.sab, offset + SYNAPSE.SOURCE_PTR, sourcePtr)
        Atomics.store(this.sab, offset + SYNAPSE.TARGET_PTR, targetPtr)
        Atomics.store(this.sab, offset + SYNAPSE.WEIGHT_DATA, weightData)
        Atomics.store(this.sab, offset + SYNAPSE.META_NEXT, 0)

        const bucketIdx = ((targetPtr * KNUTH_HASH_CONST) >>> 0) & REVERSE_INDEX.BUCKET_MASK
        const bucketOffset = this.reverseIndexI32 + bucketIdx
        const currentHead = Atomics.load(this.sab, bucketOffset)
        Atomics.store(this.sab, offset + SYNAPSE.NEXT_SAME_TARGET, currentHead)
        Atomics.store(this.sab, bucketOffset, slot)

        this.usedSlots++
        return
      }
      slot = (slot + 1) % SYNAPSE_TABLE.MAX_CAPACITY
      probes++
    }
    // Should never happen during compaction
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.KERNEL_PANIC)
  }

  // ===========================================================================
  // Helpers (Write-Specific)
  // ===========================================================================

  /**
   * Find the next empty slot starting from a seed index.
   */
  private findEmptySlot(startSlot: number): number {
    let slot = startSlot % this.capacity
    let probes = 0

    while (probes < this.capacity) {
      const offset = this.offsetForSlot(slot)
      const source = Atomics.load(this.sab, offset + SYNAPSE.SOURCE_PTR)
      if (source === NULL_PTR) return slot
      slot = (slot + 1) % this.capacity
      probes++
    }
    return -1
  }
}
