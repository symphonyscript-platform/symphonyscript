import type { SynapsePtr } from './types';
import { SynapseView } from './synapse-view';
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
export declare class SynapseAllocator extends SynapseView {
    /** Pre-allocated staging array for compaction - source pointers (Lazy) */
    private stagingSourcePtrs;
    /** Pre-allocated staging array for compaction - target pointers (Lazy) */
    private stagingTargetPtrs;
    /** Pre-allocated staging array for compaction - weight data (Lazy) */
    private stagingWeightData;
    constructor(buffer: SharedArrayBuffer);
    /**
     * Reset allocator state after table clear.
     */
    clear(): void;
    /**
      * Create a synaptic connection between two Axons.
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
     */
    disconnect(sourcePtr: number, targetPtr?: number): void;
    /**
     * Check if compaction is needed and perform if so.
     *
     * **WARNING:** This method is NOT thread-safe. Use `maybeCompactSafe()` instead
     * when concurrent operations are possible.
     */
    maybeCompact(): number;
    /**
     * Thread-safe compaction with mutex protection.
     *
     * **THREAD SAFETY:** Acquires Chain Mutex for duration of compaction.
     * This is a stop-the-world operation - use sparingly.
     *
     * @param acquireMutex - Function to acquire mutex (injected from SiliconSynapse)
     * @param releaseMutex - Function to release mutex
     * @returns Number of live synapses after compaction, or -1 if mutex acquisition failed
     */
    compactTableSafe(acquireMutex: () => boolean, releaseMutex: () => void): number;
    /**
     * Check if compaction is needed and perform with mutex protection.
     *
     * **THREAD SAFETY:** Acquires Chain Mutex for duration of compaction.
     * This is a stop-the-world operation - use sparingly.
     *
     * @param acquireMutex - Function to acquire mutex (injected from SiliconSynapse)
     * @param releaseMutex - Function to release mutex
     * @returns Number of live synapses after compaction, 0 if not needed, or -1 if mutex failed
     */
    maybeCompactSafe(acquireMutex: () => boolean, releaseMutex: () => void): number;
    /**
     * Compact the synapse table by rehashing all live entries.
     */
    compactTable(): number;
    /**
     * Direct insertion during compaction (bypasses validation).
     * @internal
     */
    private _insertDirect;
    /**
     * Find the next empty slot starting from a seed index.
     */
    private findEmptySlot;
}
//# sourceMappingURL=synapse-allocator.d.ts.map