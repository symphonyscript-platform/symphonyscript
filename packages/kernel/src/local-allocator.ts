// =============================================================================
// SymphonyScript - Local Allocator (RFC-044)
// =============================================================================
// Zone B bump-pointer allocator for Main Thread lock-free allocation.

import { HEAP_START_OFFSET, NODE_SIZE_BYTES, getZoneSplitIndex, ALLOC_ERR } from './constants'

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
export class LocalAllocator {
  private readonly sab: Int32Array
  private nextPtr: number // Byte offset to next free node
  private limitPtr: number // Byte offset to end of heap
  private startPtr: number // Byte offset where Zone B begins (for telemetry)

  // K-005: Free List State
  private freeHead: number
  private freeCount: number

  /**
   * Create a Local Allocator for Zone B.
   *
   * @param sab - SharedArrayBuffer as Int32Array view
   * @param nodeCapacity - Total node capacity of the heap
   */
  constructor(sab: Int32Array, nodeCapacity: number) {
    this.sab = sab

    // Calculate Zone B boundaries
    const zoneSplitIndex = getZoneSplitIndex(nodeCapacity)
    const zoneBStartOffset = HEAP_START_OFFSET + zoneSplitIndex * NODE_SIZE_BYTES
    const heapEndOffset = HEAP_START_OFFSET + nodeCapacity * NODE_SIZE_BYTES

    this.startPtr = zoneBStartOffset
    this.nextPtr = zoneBStartOffset
    this.limitPtr = heapEndOffset

    // K-005: Local Free List (LIFO)
    this.freeHead = -1 // NULL_PTR
    this.freeCount = 0
  }

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
  alloc(): number {
    // 1. Try to pop from free list (LIFO)
    if (this.freeHead !== -1) { // NULL_PTR
      const ptr = this.freeHead

      // Read next pointer from the node's NEXT_PTR field
      // We use NEXT_PTR (offset 12) for the free list chain
      const nextIdx = (ptr / 4) + 3 // NEXT_PTR is at offset 3 ints (12 bytes)
      const next = this.sab[nextIdx]

      this.freeHead = next
      this.freeCount = this.freeCount - 1

      // K-003: Zero-on-Alloc
      this.zeroNode(ptr)
      return ptr
    }

    // 2. Fallback to Bump Pointer
    if (this.nextPtr >= this.limitPtr) {
      return ALLOC_ERR.EXHAUSTED
    }

    const ptr = this.nextPtr
    this.nextPtr = this.nextPtr + NODE_SIZE_BYTES

    // K-003: Zero-on-Alloc (Clean as you go)
    // Ensure the node is clean before handing it out.
    this.zeroNode(ptr)

    return ptr
  }

  /**
   * Return a node to the local free list (K-005).
   * 
   * @param ptr - Byte offset of the node to free
   */
  free(ptr: number): void {
    if (ptr < this.startPtr || ptr >= this.limitPtr) {
      return // Ignore invalid pointers (or Zone A pointers)
    }

    // LIFO Push
    const idx = ptr / 4
    const nextIdx = idx + 3 // NEXT_PTR field

    // Link current head to this node's next
    this.sab[nextIdx] = this.freeHead

    // Update head to this node
    this.freeHead = ptr
    this.freeCount = this.freeCount + 1
  }

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
  private zeroNode(ptrBytes: number): void {
    const idx = ptrBytes / 4
    // Unrolled zeroing for NODE_SIZE_I32 (8 ints)
    this.sab[idx + 0] = 0
    this.sab[idx + 1] = 0
    this.sab[idx + 2] = 0
    this.sab[idx + 3] = 0
    this.sab[idx + 4] = 0
    this.sab[idx + 5] = 0
    this.sab[idx + 6] = 0
    this.sab[idx + 7] = 0
  }

  /**
   * Get the number of remaining free nodes in Zone B.
   *
   * @returns Number of nodes that can still be allocated
   */
  getFreeCount(): number {
    const remainingBytes = this.limitPtr - this.nextPtr
    return Math.floor(remainingBytes / NODE_SIZE_BYTES) + this.freeCount
  }

  /**
   * Total Zone B capacity in node slots.
   */
  getTotalSlots(): number {
    return ((this.limitPtr - this.startPtr) / NODE_SIZE_BYTES) | 0
  }

  /**
   * Number of Zone B slots currently in use (allocated minus freed).
   */
  getUsedSlots(): number {
    const usedBytes = (this.nextPtr - this.startPtr) - (this.freeCount * NODE_SIZE_BYTES)
    return (usedBytes / NODE_SIZE_BYTES) | 0
  }

  /**
   * Reset the allocator (for testing/defragmentation).
   *
   * @remarks
   * DANGER: Only call this when you know the Worker has no references to Zone B nodes.
   * Typically only used during initialization or after full GC/defrag cycle.
   */
  reset(nodeCapacity: number): void {
    const zoneSplitIndex = getZoneSplitIndex(nodeCapacity)
    const zoneBStartOffset = HEAP_START_OFFSET + zoneSplitIndex * NODE_SIZE_BYTES
    const heapEndOffset = HEAP_START_OFFSET + nodeCapacity * NODE_SIZE_BYTES
    this.startPtr = zoneBStartOffset // Update startPtr in case HEAP_START_OFFSET changed
    this.nextPtr = zoneBStartOffset
    this.freeHead = -1
    this.freeCount = 0
  }
}

// =============================================================================
// Zone B Stats Bit-Packing (Task 076)
// =============================================================================
//
// Layout (53-bit safe integer budget):
//   bits  0-15: totalSlots  (16 bits, max 65535)
//   bits 16-31: usedSlots   (16 bits, max 65535)
//   bits 32-38: utilization (7 bits, 0-100 percentage)
//
// freeSlots is derived: totalSlots - usedSlots (not packed).
// Bits 32+ use multiplication/division because JS bitwise ops are 32-bit.

export function packZoneBStats(totalSlots: number, usedSlots: number, utilization: number): number {
  return (((totalSlots & 0xFFFF) | ((usedSlots & 0xFFFF) << 16)) >>> 0) + utilization * 0x100000000
}

export function unpackZoneBTotal(packed: number): number {
  return packed & 0xFFFF
}

export function unpackZoneBUsed(packed: number): number {
  return (packed >>> 16) & 0xFFFF
}

export function unpackZoneBFree(packed: number): number {
  return (packed & 0xFFFF) - ((packed >>> 16) & 0xFFFF)
}

export function unpackZoneBUtilization(packed: number): number {
  return (packed / 0x100000000) | 0
}
