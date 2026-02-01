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
export class MinHeap<T> {
    private heap: T[] = [];

    /**
     * Create a new MinHeap.
     * COMPOSER-ONLY: Object creation.
     *
     * @param comparator - Function that returns negative if a < b, zero if equal, positive if a > b
     */
    constructor(private readonly comparator: (a: T, b: T) => number) {}

    /**
     * Add an item to the heap.
     * COMPOSER-ONLY: May cause array resize.
     *
     * @param item - Item to add
     */
    push(item: T): void {
        this.heap.push(item);
        this.siftUp(this.heap.length - 1);
    }

    /**
     * Remove and return the minimum item.
     * COMPOSER-ONLY: Array manipulation.
     *
     * @returns Minimum item or undefined if empty
     */
    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.siftDown(0);
        return min;
    }

    /**
     * Return the minimum item without removing it.
     * KERNEL-SAFE: No allocation.
     *
     * @returns Minimum item or undefined if empty
     */
    peek(): T | undefined {
        return this.heap[0];
    }

    /**
     * Check if heap is empty.
     * KERNEL-SAFE: Pure check.
     *
     * @returns True if heap is empty
     */
    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    /**
     * Return the number of items in the heap.
     * KERNEL-SAFE: Pure check.
     *
     * @returns Number of items
     */
    size(): number {
        return this.heap.length;
    }

    /**
     * Clear all items from the heap.
     * COMPOSER-ONLY: Array manipulation.
     */
    clear(): void {
        this.heap.length = 0;
    }

    /**
     * Convert heap to array (not in heap order).
     * COMPOSER-ONLY: Array creation.
     *
     * @returns Copy of internal array
     */
    toArray(): T[] {
        return [...this.heap];
    }

    /**
     * Restore heap property by moving item up.
     */
    private siftUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) {
                break;
            }
            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    /**
     * Restore heap property by moving item down.
     */
    private siftDown(index: number): void {
        const length = this.heap.length;

        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < length && this.comparator(this.heap[leftChild], this.heap[smallest]) < 0) {
                smallest = leftChild;
            }

            if (rightChild < length && this.comparator(this.heap[rightChild], this.heap[smallest]) < 0) {
                smallest = rightChild;
            }

            if (smallest === index) {
                break;
            }

            this.swap(index, smallest);
            index = smallest;
        }
    }

    /**
     * Swap two items in the heap.
     */
    private swap(i: number, j: number): void {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;
    }
}

/**
 * Create a MinHeap for numbers (ascending order).
 * COMPOSER-ONLY: Object creation.
 *
 * @returns MinHeap configured for numeric comparison
 */
export function createNumberHeap(): MinHeap<number> {
    return new MinHeap<number>((a, b) => a - b);
}

/**
 * Create a MaxHeap for numbers (descending order).
 * COMPOSER-ONLY: Object creation.
 *
 * @returns MinHeap configured for reverse numeric comparison
 */
export function createMaxHeap(): MinHeap<number> {
    return new MinHeap<number>((a, b) => b - a);
}
