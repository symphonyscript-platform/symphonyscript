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

        // Calculate reverse index offset (ISSUE-016)
        const reverseByteOffset = getReverseIndexOffset(nodeCapacity)
        this.reverseIndexI32 = reverseByteOffset / 4

        // Capacity is fixed by RFC-045 at 65536
        this.capacity = SYNAPSE_TABLE.MAX_CAPACITY
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
     * Find the Head slot for a source pointer using Linear Probe.
     * @param sourcePtr - The Trigger Node
     * @returns Slot index or -1 if not found
     */
    public findHeadSlot(sourcePtr: number): number {
        if (sourcePtr === NULL_PTR) return -1

        // Hash to find ideal slot
        let slot = this.hash(sourcePtr)
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

            slot = (slot + 1) % this.capacity
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
        // Use & (capacity - 1) since capacity is power of 2 (65536)
        // 65536 - 1 = 0xFFFF
        return (Math.imul(key, KNUTH_HASH_CONST) >>> 0) & 0xFFFF
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
