import type { NodePtr } from './types';
/**
 * MPSC Return Queue for cross-zone frees (RFC-056).
 *
 * When a worker frees a node that belongs to another zone, it enqueues
 * the pointer to that zone's Return Queue. The zone owner drains the
 * queue at the start of each poll() cycle.
 *
 * **MPSC Protocol:**
 * - enqueue(): Lock-free CAS on head (any worker can call)
 * - dequeue(): SPSC consumer (only zone owner calls)
 *
 * **Memory Layout:**
 * - Head/Tail pointers stored in Zone Config Table (RETURN_QUEUE_HEAD, RETURN_QUEUE_TAIL)
 * - Buffer data stored in Return Queue Buffers region (after Zone Config Table)
 *
 * @see RFC-056 Section 3.6 for full specification
 */
export declare class ReturnQueue {
    private sab;
    private zoneIndex;
    private workerZones;
    private headOffset;
    private tailOffset;
    private bufferOffset;
    /**
     * Create a ReturnQueue instance for a specific zone.
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param zoneIndex - Index of the zone this queue belongs to
     * @param workerZones - Total number of worker zones
     */
    constructor(sab: Int32Array, zoneIndex: number, workerZones: number);
    /**
     * Enqueue a pointer to this zone's Return Queue (MPSC producer).
     *
     * Lock-free implementation using CAS on head pointer.
     * Can be called by any worker to return a node to this zone.
     *
     * **Algorithm:**
     * 1. Load current head
     * 2. Calculate next position
     * 3. Check if queue is full (next === tail)
     * 4. Write ptr to buffer BEFORE claiming slot (avoids read-before-write race)
     * 5. CAS head from current to next
     * 6. If CAS fails, retry (another producer won)
     *
     * @param ptr - Node pointer to enqueue
     * @returns true if enqueued, false if queue is full
     */
    enqueue(ptr: NodePtr): boolean;
    /**
     * Dequeue a pointer from this zone's Return Queue (SPSC consumer).
     *
     * Only the zone owner should call this method.
     * No atomics needed for tail advancement (single consumer).
     *
     * @returns Node pointer if available, NULL_PTR if queue is empty
     */
    dequeue(): NodePtr;
    /**
     * Check if the Return Queue is empty.
     *
     * @returns true if empty, false if there are items to dequeue
     */
    isEmpty(): boolean;
    /**
     * Get the number of items currently in the queue.
     *
     * Note: This is approximate under concurrent access.
     *
     * @returns Number of items in queue
     */
    getCount(): number;
    /**
     * Initialize a zone's Return Queue in the SAB.
     *
     * Sets head and tail to 0 (empty queue).
     * Buffer is already zero-initialized by SharedArrayBuffer spec.
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param zoneIndex - Index of the zone to initialize
     * @param workerZones - Total number of worker zones
     */
    static initialize(sab: Int32Array, zoneIndex: number, workerZones: number): void;
}
//# sourceMappingURL=return-queue.d.ts.map