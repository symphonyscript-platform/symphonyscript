/**
 * Local Allocator for Zone B (UI-Owned Heap).
 *
 * This allocator provides lock-free allocation for the Main Thread by using
 * a simple bump-pointer strategy within the upper half of the node heap.
 *
 * **Architecture (RFC-044):**
 * - **Zone A (0 to splitIndex - 1):** Worker/Audio Thread uses CAS-based free list
 * - **Zone B (splitIndex to capacity - 1):** Main Thread uses this bump allocator
 *
 * **Safety:**
 * - No atomic operations required (single-threaded access)
 * - No contention with Worker's allocator (disjoint memory regions)
 * - Crash if exhausted (no reclamation in MVP)
 *
 * @remarks
 * This is a critical component of the "Local-Write, Remote-Link" protocol.
 * Nodes allocated here are "floating" until linked by the Worker via Command Ring.
 */
export declare class LocalAllocator {
    private readonly sab;
    private nextPtr;
    private limitPtr;
    private startPtr;
    private freeHead;
    private freeCount;
    /**
     * Create a Local Allocator for Zone B.
     *
     * @param sab - SharedArrayBuffer as Int32Array view
     * @param nodeCapacity - Total node capacity of the heap
     */
    constructor(sab: Int32Array, nodeCapacity: number);
    /**
     * Allocate a node from Zone B (bump pointer).
     *
     * RFC-045-04: Zero-allocation error handling via return codes.
     *
     * @returns Byte offset to the allocated node on success, or ALLOC_ERR.EXHAUSTED (-1) if Zone B is exhausted
     *
     * @remarks
     * This is an O(1) operation with zero contention. No atomic operations required.
     * The allocated node is "floating" (not in the linked list) until the Worker
     * processes the corresponding INSERT command from the Ring Buffer.
     * K-005: Checks local free list first before bumping pointer.
     */
    alloc(): number;
    /**
     * Return a node to the local free list (K-005).
     *
     * @param ptr - Byte offset of the node to free
     */
    free(ptr: number): void;
    /**
     * Zero out a node's memory region.
     * Ensures no stale data from previous sessions or reuses persists.
     *
     * **Thread Safety (Publication Safety):**
     * These writes are non-atomic (raw assignment). This is SAFE because:
     * 1. The node is currently "floating" in Zone B (exclusive to Main Thread).
     * 2. The Worker Thread has no reference to this pointer yet.
     * 3. The pointer is "published" to the Worker later via `ringBuffer.write(CMD.INSERT, ptr)`.
     * 4. `ringBuffer.write` uses `Atomics.store`, which acts as a **Release Fence**.
     * 5. The Worker reads via `Atomics.load` (**Acquire Fence**), guaranteeing it sees these writes.
     *
     * @param ptrBytes - Byte offset to the node
     */
    private zeroNode;
    /**
     * Get the number of remaining free nodes in Zone B.
     *
     * @returns Number of nodes that can still be allocated
     */
    getFreeCount(): number;
    /**
     * Get Zone B utilization (RFC-044 Telemetry).
     *
     * @returns Utilization ratio from 0.0 (empty) to 1.0 (full)
     *
     * @remarks
     * **Fuel Gauge:** Monitor this to detect approaching Zone B exhaustion.
     * - < 0.5: Healthy
     * - 0.5 - 0.75: Monitor
     * - 0.75 - 0.9: Warning
     * - > 0.9: Critical (consider hardReset or defragmentation)
     */
    getUtilization(): number;
    /**
     * Reset the allocator (for testing/defragmentation).
     *
     * @remarks
     * DANGER: Only call this when you know the Worker has no references to Zone B nodes.
     * Typically only used during initialization or after full GC/defrag cycle.
     */
    reset(nodeCapacity: number): void;
}
//# sourceMappingURL=local-allocator.d.ts.map