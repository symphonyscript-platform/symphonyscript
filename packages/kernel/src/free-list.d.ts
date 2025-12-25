import type { NodePtr } from './types';
/**
 * Lock-free free list implementation using 64-bit tagged pointers.
 *
 * The free list is a LIFO stack where:
 * - FREE_LIST_HEAD (64-bit) stores: (version << 32) | (ptr & 0xFFFFFFFF)
 * - Each free node's PACKED_A field (slot 0) stores the next free pointer (32-bit)
 * - Allocation pops from head, deallocation pushes to head
 *
 * Thread safety:
 * - All operations use Atomics.compareExchange on BigInt64Array
 * - Version counter in upper 32 bits provides ABA protection
 * - No per-node sequence counters needed for free list operations
 */
export declare class FreeList {
    private sab;
    private sab64;
    private heapStartI32;
    private nodeCapacity;
    constructor(sab: Int32Array, sab64: BigInt64Array);
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
     */
    private isValidPtr;
    /**
     * Zero out a node's fields (called after allocation).
     */
    private zeroNode;
    /**
     * Allocate a node from the free list.
     *
     * Uses 64-bit tagged pointer CAS to eliminate ABA problem.
     * Tagged pointer format: (version << 32) | (ptr & 0xFFFFFFFF)
     *
     * Returns NULL_PTR if heap is exhausted.
     */
    alloc(): NodePtr;
    /**
     * Return a node to the free list.
     *
     * Uses 64-bit tagged pointer CAS to eliminate ABA problem.
     * Version counter is incremented on every free operation.
     */
    free(ptr: NodePtr): void;
    /**
     * Get the current count of free nodes.
     */
    getFreeCount(): number;
    /**
     * Get the current count of allocated nodes.
     */
    getNodeCount(): number;
    /**
     * Check if the free list is empty.
     */
    isEmpty(): boolean;
    /**
     * Initialize the free list with all nodes.
     * Called once during SAB initialization.
     *
     * Links all nodes in the heap into a free list chain.
     * Initializes FREE_LIST_HEAD as 64-bit tagged pointer with version 0.
     */
    /**
     * Initialize the free list with Zone A nodes only (RFC-044).
     *
     * @param sab - Int32Array view of SharedArrayBuffer
     * @param sab64 - BigInt64Array view for atomic 64-bit operations
     * @param zoneASize - Number of nodes in Zone A (Worker-owned)
     * @param totalCapacity - Total node capacity of heap (Zone A + Zone B)
     *
     * @remarks
     * RFC-044 partitions the heap into Zone A (Worker) and Zone B (Main Thread).
     * The free list only contains Zone A nodes. Zone B nodes are managed by LocalAllocator.
     */
    static initialize(sab: Int32Array, sab64: BigInt64Array, zoneASize: number, totalCapacity: number): void;
}
//# sourceMappingURL=free-list.d.ts.map