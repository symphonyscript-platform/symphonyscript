import type { NodePtr } from './types';
/**
 * SPSC FreeList - Zero allocation memory management (RFC-055, RFC-056).
 *
 * The free list is a LIFO stack where:
 * - FREE_LIST_HEAD_LOW (32-bit) stores the head pointer (legacy mode)
 * - Or ZONE_CONFIG.FREE_LIST_HEAD stores the head pointer (multi-zone mode)
 * - Each free node's PACKED_A field (slot 0) stores the next free pointer
 * - Allocation pops from head, deallocation pushes to head
 *
 * SPSC Invariant:
 * - Only the AudioWorklet thread may call alloc() or free()
 * - No CAS needed - simple atomic load/store with memory barriers
 * - Zero BigInt allocation (eliminates GC pressure in hot path)
 *
 * RFC-056 Multi-Zone:
 * - Each zone has its own FreeList with bounded heap region
 * - Cross-zone frees are routed to the target zone's Return Queue
 * - drainReturnQueue() must be called at start of each poll() cycle
 *
 * @see RFC-055 for SPSC architectural justification
 * @see RFC-056 for multi-zone architecture
 */
export declare class FreeList {
    private sab;
    private heapStartI32;
    private nodeCapacity;
    private zoneIndex;
    private zoneConfigOffset;
    private zoneHeapStartI32;
    private zoneHeapEndI32;
    private zoneSizeBytes;
    private workerZones;
    private globalHeapStart;
    private returnQueue;
    private allReturnQueues;
    private freeListHeadOffset;
    private freeCountOffset;
    /**
     * Create a new FreeList instance.
     *
     * RFC-055: No BigInt64Array needed — SPSC uses 32-bit atomics only.
     * RFC-056: Optional parameters for multi-zone support with backward compatibility.
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param zoneIndex - Zone index (default: 0 for legacy single-zone mode)
     * @param zoneConfigOffset - Byte offset to zone config table (default: -1 for legacy mode)
     */
    constructor(sab: Int32Array, zoneIndex?: number, zoneConfigOffset?: number);
    /**
     * Convert a byte pointer to i32 index within the SAB.
     */
    private ptrToI32Index;
    /**
     * Convert an i32 index to byte pointer.
     */
    private i32IndexToPtr;
    /**
     * Get the i32 offset for a node given its byte pointer.
     */
    nodeOffset(ptr: NodePtr): number;
    /**
     * Validate that a pointer is within the heap bounds.
     * In multi-zone mode, validates against this zone's bounds.
     */
    private isValidPtr;
    /**
     * Validate that a pointer is within the global heap bounds (any zone).
     * Used for cross-zone free validation.
     */
    private isValidGlobalPtr;
    /**
     * Zero out a node's fields (called after allocation).
     */
    private zeroNode;
    /**
     * Allocate a node from the free list.
     *
     * SPSC Implementation (RFC-055):
     * - No CAS loop needed - single thread access guaranteed
     * - Zero BigInt allocation
     * - Simple load → read next → store pattern
     *
     * RFC-056: Uses zone-specific header offsets in multi-zone mode.
     *
     * @returns Node pointer, or NULL_PTR if heap exhausted or corrupted
     *
     * @remarks
     * - SPSC INVARIANT: Only AudioWorklet thread may call this
     * - Zero-allocation: Uses error codes, not exceptions
     * - O(1) time complexity
     */
    alloc(): NodePtr;
    /**
     * Return a node to the free list.
     *
     * SPSC Implementation (RFC-055):
     * - No CAS loop needed - single thread access guaranteed
     * - Zero BigInt allocation
     * - Simple store → load → store pattern
     * - SEQ counter still incremented for stale reference detection
     *
     * RFC-056 Multi-Zone:
     * - If pointer belongs to this zone: local free (SPSC)
     * - If pointer belongs to another zone: enqueue to that zone's Return Queue
     */
    free(ptr: NodePtr): void;
    /**
     * Local free implementation (SPSC, same zone).
     * Called directly for same-zone frees and from drainReturnQueue().
     *
     * @remarks
     * - SPSC INVARIANT: Only zone owner may call this
     * - Implements LIFO stack push operation
     * - SEQ counter increment invalidates stale references
     */
    private _localFree;
    /**
     * Enqueue a pointer to another zone's Return Queue (RFC-056).
     *
     * @param ptr - Node pointer to return
     * @param targetZone - Index of the zone that owns this pointer
     */
    private _enqueueToReturnQueue;
    /**
     * Determine which zone a pointer belongs to (RFC-056).
     *
     * O(1) lookup using arithmetic (requires equal-sized zones).
     *
     * @param ptr - Node byte pointer
     * @returns Zone index (0+) if valid, -1 if out of heap range
     */
    getZoneForPtr(ptr: NodePtr): number;
    /**
     * Drain the Return Queue at the start of each poll() cycle (RFC-056).
     *
     * Processes all cross-zone frees that were enqueued by other workers.
     * Must be called by the zone owner before processing commands.
     *
     * In legacy mode (workerZones: 1), this is a no-op.
     */
    drainReturnQueue(): void;
    /**
     * Get the current count of free nodes.
     * RFC-056: Uses zone-specific offset in multi-zone mode.
     */
    getFreeCount(): number;
    /**
     * Get the current count of allocated nodes.
     * Note: In multi-zone mode, this returns the global count, not zone-specific.
     */
    getNodeCount(): number;
    /**
     * Check if the free list is empty.
     *
     * SPSC Implementation (RFC-055): Simple 32-bit load.
     * RFC-056: Uses zone-specific offset in multi-zone mode.
     */
    isEmpty(): boolean;
    /**
     * Get the zone index this FreeList manages.
     */
    getZoneIndex(): number;
    /**
     * Check if this FreeList is in legacy (single-zone) mode.
     */
    isLegacyMode(): boolean;
    /**
     * Initialize the free list with Zone A nodes only (RFC-044, RFC-055).
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param zoneASize - Number of nodes in Zone A (Worker-owned)
     * @param totalCapacity - Total node capacity of heap (Zone A + Zone B)
     *
     * @remarks
     * RFC-044 partitions the heap into Zone A (Worker) and Zone B (Main Thread).
     * The free list only contains Zone A nodes. Zone B nodes are managed by LocalAllocator.
     *
     * RFC-055: Uses 32-bit FREE_LIST_HEAD_LOW instead of 64-bit tagged pointer.
     * No BigInt64Array needed.
     */
    static initialize(sab: Int32Array, zoneASize: number, totalCapacity: number): void;
    /**
     * Initialize a specific zone's free list (RFC-056 Multi-Zone).
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param zoneIndex - Index of the zone to initialize
     * @param heapStartBytes - Byte offset where this zone's heap starts
     * @param heapEndBytes - Byte offset where this zone's heap ends (exclusive)
     * @param zoneCapacity - Number of nodes in this zone
     * @param zoneConfigOffset - Byte offset to zone config table
     *
     * @remarks
     * RFC-056: Each worker zone has its own free list with bounded heap region.
     * The zone config table stores per-zone metadata (head, count, bounds).
     */
    static initializeZone(sab: Int32Array, zoneIndex: number, heapStartBytes: number, heapEndBytes: number, zoneCapacity: number, zoneConfigOffset: number): void;
}
//# sourceMappingURL=free-list.d.ts.map