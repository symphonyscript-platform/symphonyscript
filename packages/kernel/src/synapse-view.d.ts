/**
 * Synapse View - Read-Only Access to the Synapse Table.
 *
 * Base class for SynapseAllocator. Provides O(1) traversal and observability
 * without the memory overhead of write buffers (staging arrays).
 *
 * Ideal for main-thread visualization (SiliconBridge).
 */
export declare class SynapseView {
    protected readonly sab: Int32Array;
    protected readonly tableOffsetI32: number;
    protected readonly reverseIndexI32: number;
    protected readonly capacity: number;
    protected readonly hashMask: number;
    protected usedSlots: number;
    protected tombstoneCount: number;
    constructor(buffer: SharedArrayBuffer);
    getLoadFactor(): number;
    getUsedSlots(): number;
    getActiveSlots(): number;
    getTombstoneRatio(): number;
    /**
     * Find the Head slot for a source pointer using Linear Probe.
     * @param sourcePtr - The Trigger Node
     * @returns Slot index or -1 if not found
     */
    findHeadSlot(sourcePtr: number): number;
    /**
     * Get the next node pointer in the chain from a given slot.
     */
    getNextPtr(slot: number): number;
    protected hash(key: number): number;
    protected offsetForSlot(slot: number): number;
    protected ptrFromSlot(slot: number): number;
    protected slotFromPtr(ptr: number): number;
}
//# sourceMappingURL=synapse-view.d.ts.map