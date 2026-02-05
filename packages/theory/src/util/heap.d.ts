/**
 * RFC-047: MinHeap (24-EDO Native)
 *
 * Generic MinHeap implementation with custom comparator.
 * Used by streaming coalesce to maintain beat-order without re-sorting.
 *
 * Time complexity:
 * - push: O(log n)
 * - pop: O(log n)
 * - peek: O(1)
 * - isEmpty: O(1)
 * - size: O(1)
 *
 * COMPOSER-ONLY: Class with internal array allocation.
 */
/**
 * Generic MinHeap with custom comparator.
 * COMPOSER-ONLY: Allocates internal array.
 */
export declare class MinHeap<T> {
    private readonly comparator;
    private heap;
    /**
     * Create a new MinHeap.
     * COMPOSER-ONLY: Object creation.
     *
     * @param comparator - Function that returns negative if a < b, zero if equal, positive if a > b
     */
    constructor(comparator: (a: T, b: T) => number);
    /**
     * Add an item to the heap.
     * COMPOSER-ONLY: May cause array resize.
     *
     * @param item - Item to add
     */
    push(item: T): void;
    /**
     * Remove and return the minimum item.
     * COMPOSER-ONLY: Array manipulation.
     *
     * @returns Minimum item or undefined if empty
     */
    pop(): T | undefined;
    /**
     * Return the minimum item without removing it.
     * KERNEL-SAFE: No allocation.
     *
     * @returns Minimum item or undefined if empty
     */
    peek(): T | undefined;
    /**
     * Check if heap is empty.
     * KERNEL-SAFE: Pure check.
     *
     * @returns True if heap is empty
     */
    isEmpty(): boolean;
    /**
     * Return the number of items in the heap.
     * KERNEL-SAFE: Pure check.
     *
     * @returns Number of items
     */
    size(): number;
    /**
     * Clear all items from the heap.
     * COMPOSER-ONLY: Array manipulation.
     */
    clear(): void;
    /**
     * Convert heap to array (not in heap order).
     * COMPOSER-ONLY: Array creation.
     *
     * @returns Copy of internal array
     */
    toArray(): T[];
    /**
     * Restore heap property by moving item up.
     */
    private siftUp;
    /**
     * Restore heap property by moving item down.
     */
    private siftDown;
    /**
     * Swap two items in the heap.
     */
    private swap;
}
/**
 * Create a MinHeap for numbers (ascending order).
 * COMPOSER-ONLY: Object creation.
 *
 * @returns MinHeap configured for numeric comparison
 */
export declare function createNumberHeap(): MinHeap<number>;
/**
 * Create a MaxHeap for numbers (descending order).
 * COMPOSER-ONLY: Object creation.
 *
 * @returns MinHeap configured for reverse numeric comparison
 */
export declare function createMaxHeap(): MinHeap<number>;
//# sourceMappingURL=heap.d.ts.map