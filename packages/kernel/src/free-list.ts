// =============================================================================
// SymphonyScript - Silicon Linker Free List (RFC-055 SPSC)
// =============================================================================
// Zero-allocation SPSC (Single-Producer Single-Consumer) free list.
// RFC-055: Replaces MPMC 64-bit CAS with simple 32-bit load/store.
//
// INVARIANT: Only the Worker thread (AudioWorklet) may call alloc() or free().
// Violation will cause data corruption. See RFC-055.

import {
  HDR,
  NODE,
  NODE_SIZE_I32,
  NULL_PTR,
  SEQ,
  HEAP_START_OFFSET,
  ERROR
} from './constants'
import type { NodePtr } from './types'

/**
 * SPSC FreeList - Zero allocation memory management (RFC-055).
 *
 * The free list is a LIFO stack where:
 * - FREE_LIST_HEAD_LOW (32-bit) stores the head pointer
 * - Each free node's PACKED_A field (slot 0) stores the next free pointer
 * - Allocation pops from head, deallocation pushes to head
 *
 * SPSC Invariant:
 * - Only the AudioWorklet thread may call alloc() or free()
 * - No CAS needed - simple atomic load/store with memory barriers
 * - Zero BigInt allocation (eliminates GC pressure in hot path)
 *
 * @see RFC-055 for architectural justification
 */
export class FreeList {
  private sab: Int32Array
  private heapStartI32: number
  private nodeCapacity: number

  /**
   * Create a new FreeList instance.
   *
   * RFC-055: No BigInt64Array needed — SPSC uses 32-bit atomics only.
   *
   * @param sab - Int32Array view of SharedArrayBuffer
   */
  constructor(sab: Int32Array) {
    this.sab = sab
    // Heap starts at byte offset 168 (HEAP_START_OFFSET), which is i32 index 42
    this.heapStartI32 = HEAP_START_OFFSET / 4
    this.nodeCapacity = sab[HDR.NODE_CAPACITY]
  }

  /**
   * Convert a byte pointer to i32 index within the SAB.
   */
  private ptrToI32Index(ptr: NodePtr): number {
    return ptr / 4
  }

  /**
   * Convert an i32 index to byte pointer.
   */
  private i32IndexToPtr(index: number): NodePtr {
    return index * 4
  }

  /**
   * Get the i32 offset for a node given its byte pointer.
   */
  nodeOffset(ptr: NodePtr): number {
    return this.ptrToI32Index(ptr)
  }

  /**
   * Validate that a pointer is within the heap bounds.
   */
  private isValidPtr(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return true // NULL is valid (means end)

    const i32Index = this.ptrToI32Index(ptr)
    const nodeIndex = (i32Index - this.heapStartI32) / NODE_SIZE_I32

    return (
      nodeIndex >= 0 &&
      nodeIndex < this.nodeCapacity &&
      (i32Index - this.heapStartI32) % NODE_SIZE_I32 === 0
    )
  }

  /**
   * Zero out a node's fields (called after allocation).
   */
  private zeroNode(offset: number): void {
    this.sab[offset + NODE.PACKED_A] = 0
    this.sab[offset + NODE.BASE_TICK] = 0
    this.sab[offset + NODE.DURATION] = 0
    this.sab[offset + NODE.NEXT_PTR] = NULL_PTR
    this.sab[offset + NODE.PREV_PTR] = NULL_PTR
    this.sab[offset + NODE.SOURCE_ID] = 0
    // Keep SEQ_FLAGS - we increment SEQ on free, don't reset it
    this.sab[offset + NODE.LAST_PASS_ID] = 0
  }

  /**
   * Allocate a node from the free list.
   *
   * SPSC Implementation (RFC-055):
   * - No CAS loop needed - single thread access guaranteed
   * - Zero BigInt allocation
   * - Simple load → read next → store pattern
   *
   * Returns NULL_PTR if heap is exhausted or free list corrupted.
   */
  alloc(): NodePtr {
    // Load current head (32-bit, memory barrier for visibility)
    const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)

    // Heap exhausted
    if (head === NULL_PTR) {
      return NULL_PTR
    }

    // Validate pointer
    if (!this.isValidPtr(head)) {
      // Corrupted free list - set error flag (zero-allocation)
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return NULL_PTR
    }

    const headOffset = this.nodeOffset(head)

    // Read the next pointer from the free node
    // In free nodes, PACKED_A stores the next free pointer (32-bit)
    const next = Atomics.load(this.sab, headOffset + NODE.PACKED_A)

    // Update head (32-bit, memory barrier for visibility) — NO CAS NEEDED
    Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, next)

    // Zero the node (except SEQ which we preserve)
    this.zeroNode(headOffset)

    // Update counters atomically
    // RFC-045: NODE_COUNT is now incremented by executeInsert (when node is linked)
    Atomics.sub(this.sab, HDR.FREE_COUNT, 1)

    return head
  }

  /**
   * Return a node to the free list.
   *
   * SPSC Implementation (RFC-055):
   * - No CAS loop needed - single thread access guaranteed
   * - Zero BigInt allocation
   * - Simple store → load → store pattern
   * - SEQ counter still incremented for stale reference detection
   */
  free(ptr: NodePtr): void {
    if (ptr === NULL_PTR) {
      return // Ignore null frees
    }

    if (!this.isValidPtr(ptr)) {
      // Invalid pointer - set error flag (zero-allocation)
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return
    }

    const offset = this.nodeOffset(ptr)

    // Increment SEQ counter to invalidate any stale references (for versioned reads)
    // SEQ is in upper 24 bits of SEQ_FLAGS (SEQ.SEQ_SHIFT = 8)
    Atomics.add(this.sab, offset + NODE.SEQ_FLAGS, 1 << SEQ.SEQ_SHIFT)

    // Load current head (32-bit, memory barrier)
    const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)

    // Point new node to current head (using PACKED_A slot)
    Atomics.store(this.sab, offset + NODE.PACKED_A, head)

    // Make new node the head (32-bit, memory barrier) — NO CAS NEEDED
    Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, ptr)

    // Update counters atomically
    // RFC-045: NODE_COUNT is now decremented by executeDelete (when node is unlinked)
    Atomics.add(this.sab, HDR.FREE_COUNT, 1)
  }

  /**
   * Get the current count of free nodes.
   */
  getFreeCount(): number {
    return Atomics.load(this.sab, HDR.FREE_COUNT)
  }

  /**
   * Get the current count of allocated nodes.
   */
  getNodeCount(): number {
    return Atomics.load(this.sab, HDR.NODE_COUNT)
  }

  /**
   * Check if the free list is empty.
   *
   * SPSC Implementation (RFC-055): Simple 32-bit load.
   */
  isEmpty(): boolean {
    return Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW) === NULL_PTR
  }

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
  static initialize(
    sab: Int32Array,
    zoneASize: number,
    totalCapacity: number
  ): void {
    const heapStartI32 = HEAP_START_OFFSET / 4

    // Link Zone A nodes into free list: node[i].PACKED_A = ptr to node[i+1]
    // Last node points to NULL_PTR
    // Zone B nodes (from zoneASize to totalCapacity - 1) are left uninitialized
    let i = 0
    while (i < zoneASize) {
      const offset = heapStartI32 + i * NODE_SIZE_I32
      // const ptr = offset * 4 // Convert i32 index to byte pointer (unused in loop)

      // Initialize SEQ_FLAGS with initial sequence number 0
      sab[offset + NODE.SEQ_FLAGS] = 0

      if (i < zoneASize - 1) {
        // Point to next node in Zone A
        const nextOffset = heapStartI32 + (i + 1) * NODE_SIZE_I32
        const nextPtr = nextOffset * 4
        sab[offset + NODE.PACKED_A] = nextPtr
      } else {
        // Last Zone A node points to null
        sab[offset + NODE.PACKED_A] = NULL_PTR
      }

      // Zero out other fields
      sab[offset + NODE.BASE_TICK] = 0
      sab[offset + NODE.DURATION] = 0
      sab[offset + NODE.NEXT_PTR] = NULL_PTR
      sab[offset + NODE.PREV_PTR] = NULL_PTR
      sab[offset + NODE.SOURCE_ID] = 0
      sab[offset + NODE.LAST_PASS_ID] = 0
      i = i + 1
    }

    // Set header pointers
    const firstNodePtr = heapStartI32 * 4

    // RFC-055: Initialize 32-bit FREE_LIST_HEAD_LOW (replaces 64-bit tagged pointer)
    // No version counter needed in SPSC — ABA problem doesn't exist with single thread
    Atomics.store(sab, HDR.FREE_LIST_HEAD_LOW, firstNodePtr)

    sab[HDR.HEAD_PTR] = NULL_PTR // Empty chain initially
    sab[HDR.FREE_COUNT] = zoneASize // Only Zone A nodes in free list
    sab[HDR.NODE_COUNT] = 0
    sab[HDR.NODE_CAPACITY] = totalCapacity // Total capacity (Zone A + Zone B)
    sab[HDR.HEAP_START] = HEAP_START_OFFSET
  }
}
