// =============================================================================
// SymphonyScript - Synapse View (RFC-045)
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
    getReverseIndexOffset
} from './constants'
import type { SynapsePtr } from './types'

/**
 * Synapse View - Read-Only Access to the Synapse Table.
 *
 * Base class for SynapseAllocator. Provides O(1) traversal and observability
 * without the memory overhead of write buffers (staging arrays).
 *
 * Ideal for main-thread visualization (SiliconBridge).
 */
export class SynapseView {
    protected readonly sab: Int32Array
    protected readonly tableOffsetI32: number
    protected readonly reverseIndexI32: number
    protected readonly capacity: number
    protected readonly hashMask: number // K-002: Dynamic hash mask

    // Tracking counters (Read-Only access via getters)
    // Note: Modifications should only happen in the Allocator subclass
    protected usedSlots: number = 0
    protected tombstoneCount: number = 0

    constructor(buffer: SharedArrayBuffer) {
        this.sab = new Int32Array(buffer)

        // Calculate table offset dynamically based on layout
        const nodeCapacity = this.sab[HDR.NODE_CAPACITY]
        const byteOffset = getSynapseTableOffset(nodeCapacity)
        this.tableOffsetI32 = byteOffset / 4

        // K-002: Read capacity from header (dynamic sizing)
        this.capacity = this.sab[HDR.SYNAPSE_CAPACITY]
        // Hash mask for power-of-2 modulo (capacity must be power of 2)
        this.hashMask = this.capacity - 1

        // Calculate reverse index offset (ISSUE-016) - K-002: pass dynamic capacity
        const reverseByteOffset = getReverseIndexOffset(nodeCapacity, this.capacity)
        this.reverseIndexI32 = reverseByteOffset / 4

        // RFC-059 R-007: Restore persisted counters when re-instantiating over existing SAB
        this.usedSlots = Atomics.load(this.sab, HDR.SYNAPSE_USED_SLOTS)
        this.tombstoneCount = Atomics.load(this.sab, HDR.SYNAPSE_TOMBSTONES)
    }

    // ===========================================================================
    // Observability / Telemetry
    // ===========================================================================

    getLoadFactor(): number {
        return (this.usedSlots - this.tombstoneCount) / this.capacity
    }

    getUsedSlots(): number {
        return this.usedSlots
    }

    getActiveSlots(): number {
        return this.usedSlots - this.tombstoneCount
    }

    getTombstoneRatio(): number {
        if (this.usedSlots === 0) return 0
        return this.tombstoneCount / this.usedSlots
    }

    // ===========================================================================
    // Traversal Helpers (Protected/Public)
    // ===========================================================================

    /**
     * Find the Head slot for a source pointer using triangular probing.
     * @param sourcePtr - The Trigger Node

     * @returns Slot index or -1 if not found
     */
    public findHeadSlot(sourcePtr: number): number {
        if (sourcePtr === NULL_PTR) return -1

        // Hash to find ideal slot
        let slot = this.hash(sourcePtr)
        let step = 1
        let probes = 0

        while (probes < this.capacity) {
            const offset = this.offsetForSlot(slot)
            const storedSource = Atomics.load(this.sab, offset + SYNAPSE.SOURCE_PTR)

            if (storedSource === sourcePtr) {
                return slot // Found it
            }

            if (storedSource === NULL_PTR) {
                // Hit empty slot -> key doesn't exist
                return -1
            }

            slot = (slot + step) & this.hashMask
            step++
            probes++
        }
        return -1
    }

    /**
     * Get the next node pointer in the chain from a given slot.
     */
    public getNextPtr(slot: number): number {
        const offset = this.offsetForSlot(slot)
        const meta = Atomics.load(this.sab, offset + SYNAPSE.META_NEXT)
        // Extract 24-bit pointer
        return (meta >>> SYN_PACK.NEXT_PTR_SHIFT) & SYN_PACK.NEXT_PTR_MASK
    }

    // ===========================================================================
    // Internal Helpers
    // ===========================================================================

    protected hash(key: number): number {
        // Knuth Multiplicative Hash
        // K-002: Use dynamic mask for variable capacity (power of 2)
        return (Math.imul(key, KNUTH_HASH_CONST) >>> 0) & this.hashMask
    }

    protected offsetForSlot(slot: number): number {
        return this.tableOffsetI32 + (slot * SYNAPSE_TABLE.STRIDE_I32)
    }

    protected ptrFromSlot(slot: number): number {
        return (this.tableOffsetI32 * 4) + (slot * SYNAPSE_TABLE.STRIDE_BYTES)
    }

    protected slotFromPtr(ptr: number): number {
        const tableStart = this.tableOffsetI32 * 4
        return (ptr - tableStart) / SYNAPSE_TABLE.STRIDE_BYTES
    }
}
