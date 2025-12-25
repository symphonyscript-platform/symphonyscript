import type { SynapsePtr } from './types';
/**
 * Synapse Allocator - The "Dendrite" Manager for the Silicon Brain.
 *
 * Manages the 1MB Synapse Table in the SharedArrayBuffer. This class implements
 * a high-performance Linear Probe Hash Table to map Axons (Source Nodes) to
 * Synapses (Connections).
 *
 * Topology:
 * - Table Size: 65,536 entries (1MB)
 * - Hash: Knuth's Multiplicative Hash on SOURCE_PTR
 * - Collision Strategy: Linear Probing for "Head" slots
 * - Fan-Out: Linked List (NEXT_SYNAPSE_PTR) for multiple targets from one source
 *
 * Thread Safety:
 * - Designed for single-writer (Worker/Kernel) access via Command Ring.
 * - Uses Atomics for all writes to ensure the Audio Thread never sees torn data.
 */
export declare class SynapseAllocator {
    private readonly sab;
    private readonly tableOffsetI32;
    private readonly reverseIndexI32;
    private readonly capacity;
    /** Tracks number of used slots for load factor monitoring (RFC-045-02 directive) */
    private usedSlots;
    /** Tracks number of tombstoned entries (ISSUE-021) */
    private tombstoneCount;
    /** Pre-allocated staging array for compaction - source pointers (ISSUE-021) */
    private readonly stagingSourcePtrs;
    /** Pre-allocated staging array for compaction - target pointers (ISSUE-021) */
    private readonly stagingTargetPtrs;
    /** Pre-allocated staging array for compaction - weight data (ISSUE-021) */
    private readonly stagingWeightData;
    constructor(buffer: SharedArrayBuffer);
    /**
     * Get the current load factor of the Synapse Table.
     * Accounts for tombstoned entries to reflect actual usage.
     * @returns Load factor as a ratio (0.0 to 1.0)
     */
    getLoadFactor(): number;
    /**
     * Get the number of used slots in the Synapse Table (including tombstones).
     * @returns Number of slots currently in use
     */
    getUsedSlots(): number;
    /**
     * Get the number of active (non-tombstoned) slots.
     * @returns Number of live synapse entries
     */
    getActiveSlots(): number;
    /**
     * Get the ratio of tombstoned entries to total used slots.
     * High ratio (>0.5) indicates table should be compacted.
     * @returns Tombstone ratio (0.0 to 1.0)
     */
    getTombstoneRatio(): number;
    /**
     * Reset allocator state after table clear.
     *
     * **Note:** Actual memory clearing is done by SiliconSynapse.synapseTableClear().
     * This method resets the allocator's internal tracking counters.
     */
    clear(): void;
    /**
     * Create a synaptic connection between two Axons.
     *
     * This is an O(1) operation (amortized) that writes a "Dendrite" into the
     * shared memory. If the source already has connections, this appends to
     * the fan-out chain.
     *
     * Thread Safety (RFC-045-02 CORRECTION-01):
     * For append operations, data writes MUST complete before linking to prevent
     * the Audio Thread from following a valid link to uninitialized memory.
     *
     * RFC-045-04: Zero-allocation error handling via return codes.
     *
     * @param sourcePtr - The Trigger Node (End of Clip)
     * @param targetPtr - The Destination Node (Start of Next Clip)
     * @param weight - Probability/Intensity (0-1000)
     * @param jitter - Micro-timing deviation in ticks (0-65535)
     * @returns The SynapsePtr to the new entry on success, or negative error code
     */
    connect(sourcePtr: number, targetPtr: number, weight: number, jitter: number): SynapsePtr;
    /**
     * Sever a synaptic connection.
     *
     * Implements "Tombstoning" by setting TARGET_PTR to NULL. The connection
     * remains in the chain but is skipped by the Kernel during resolution.
     * This preserves the linked list integrity for other targets.
     *
     * @param sourcePtr - The Trigger Node
     * @param targetPtr - (Optional) Specific target to disconnect. If omitted, disconnects ALL.
     */
    disconnect(sourcePtr: number, targetPtr?: number): void;
    /**
     * Check if compaction is needed and perform if so.
     * COLD PATH - Called after disconnect operations.
     *
     * @returns Number of entries compacted (0 if no compaction needed)
     */
    maybeCompact(): number;
    /**
     * Compact the synapse table by rehashing all live entries.
     * COLD PATH - O(n) where n = table capacity.
     *
     * **Thread Safety:** Must NOT be called while audio thread is active.
     * Caller must ensure exclusive access (e.g., during pause or clear).
     *
     * **Algorithm:**
     * 1. Scan table for live entries (SOURCE_PTR != NULL && TARGET_PTR != NULL)
     * 2. Collect live entries into staging arrays
     * 3. Clear entire table
     * 4. Clear reverse index buckets
     * 5. Reinsert live entries with fresh hash positions
     *
     * @returns Number of entries compacted
     */
    compactTable(): number;
    /**
     * Direct insertion during compaction (bypasses validation).
     * @internal
     */
    private _insertDirect;
    /** Knuth's Multiplicative Hash (using KNUTH_HASH_CONST per RFC-045) */
    private hash;
    /**
     * Find the slot containing the "Head" of the chain for a source.
     * Uses Linear Probing.
     * * @returns Slot index, or -1 if not found.
     */
    private findHeadSlot;
    /**
     * Find the next empty slot starting from a seed index.
     * Used for allocating new entries (heads or overflow links).
     */
    private findEmptySlot;
    /** Convert slot index to i32 index in SAB */
    private offsetForSlot;
    /** Convert slot index to Byte Pointer (relative to start of SAB) */
    private ptrFromSlot;
    /** Convert Byte Pointer to slot index */
    private slotFromPtr;
    /** Extract Next Pointer from a slot's META_NEXT field */
    private getNextPtr;
}
//# sourceMappingURL=synapse-allocator.d.ts.map