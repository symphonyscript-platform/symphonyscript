// =============================================================================
// SymphonyScript - Silicon Linker Free List (RFC-055 SPSC, RFC-056 Multi-Zone)
// =============================================================================
// Zero-allocation SPSC (Single-Producer Single-Consumer) free list.
// RFC-055: Replaces MPMC 64-bit CAS with simple 32-bit load/store.
// RFC-056: Extends to support multi-zone heap partitioning with cross-zone frees.
//
// INVARIANT: Only the Worker thread (AudioWorklet) may call alloc() or free().
// Violation will cause data corruption. See RFC-055.

import {
  HDR,
  NODE,
  NODE_SIZE_I32,
  NODE_SIZE_BYTES,
  NULL_PTR,
  SEQ,
  HEAP_START_OFFSET,
  ERROR,
  ZONE_CONFIG,
  ZONE_CONFIG_STRIDE,
  getZoneSplitIndex
} from './constants'
import { ReturnQueue } from './return-queue'
import type { NodePtr } from './types'

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
   * Runtime enforcement boundary:
   * - FreeList itself is a low-level primitive and assumes SPSC contract.
   * - Public kernel APIs enforce that contract before reaching here:
   *   `SiliconSynapse.allocNode()/freeNode()` gate calls with `isAudioContext`
   *   and hard-fail with ERROR.SPSC_VIOLATION outside audio context.
   * - processCommands()/poll() execute on the audio side, so command-driven frees
   *   also satisfy the same single-owner mutation model.
 *
 * RFC-056 Multi-Zone:
 * - Each zone has its own FreeList with bounded heap region
 * - Cross-zone frees are routed to the target zone's Return Queue
 * - drainReturnQueue() must be called at start of each poll() cycle
 *
 * @see RFC-055 for SPSC architectural justification
 * @see RFC-056 for multi-zone architecture
 */
export class FreeList {
  private sab: Int32Array
  private heapStartI32: number
  private nodeCapacity: number

  // RFC-056: Multi-zone fields
  private zoneIndex: number
  private zoneConfigOffset: number // -1 = legacy mode
  private zoneHeapStartI32: number // Start of this zone's heap region
  private zoneHeapEndI32: number // End of this zone's heap region (exclusive)
  private zoneSizeBytes: number // Size of each zone in bytes (for O(1) lookup)
  private workerZones: number // Total number of worker zones
  private globalHeapStart: number // Global heap start in bytes
  private returnQueue: ReturnQueue | null // Return Queue for this zone (null in legacy)
  private allReturnQueues: ReturnQueue[] // All Return Queues for cross-zone enqueue

  // Header offsets for this zone's free list (differ between legacy and multi-zone)
  private freeListHeadOffset: number
  private freeCountOffset: number

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
  constructor(sab: Int32Array, zoneIndex: number = 0, zoneConfigOffset: number = -1) {
    this.sab = sab
    this.zoneIndex = zoneIndex
    this.zoneConfigOffset = zoneConfigOffset
    this.nodeCapacity = sab[HDR.NODE_CAPACITY]
    this.globalHeapStart = HEAP_START_OFFSET

    if (zoneConfigOffset === -1) {
      // LEGACY MODE (workerZones: 1): Use existing header layout
      this.heapStartI32 = HEAP_START_OFFSET / 4
      this.zoneHeapStartI32 = this.heapStartI32
      this.zoneHeapEndI32 = this.heapStartI32 + getZoneSplitIndex(this.nodeCapacity) * NODE_SIZE_I32
      this.zoneSizeBytes = 0 // Not used in legacy mode
      this.workerZones = 1
      this.returnQueue = null
      this.allReturnQueues = []
      this.freeListHeadOffset = HDR.FREE_LIST_HEAD_LOW
      this.freeCountOffset = HDR.FREE_COUNT
    } else {
      // MULTI-ZONE MODE: Read bounds from zone config table
      const configBaseI32 = zoneConfigOffset / 4 + zoneIndex * ZONE_CONFIG_STRIDE
      this.workerZones = sab[HDR.ZONE_COUNT]

      // Read zone bounds from config table
      const heapStartBytes = sab[configBaseI32 + ZONE_CONFIG.HEAP_START]
      const heapEndBytes = sab[configBaseI32 + ZONE_CONFIG.HEAP_END]

      this.heapStartI32 = HEAP_START_OFFSET / 4
      this.zoneHeapStartI32 = heapStartBytes / 4
      this.zoneHeapEndI32 = heapEndBytes / 4

      // Calculate zone size for O(1) pointer-to-zone lookup
      const zoneCapacity = sab[configBaseI32 + ZONE_CONFIG.NODE_CAPACITY]
      this.zoneSizeBytes = zoneCapacity * NODE_SIZE_BYTES

      // Set up header offsets for this zone
      this.freeListHeadOffset = configBaseI32 + ZONE_CONFIG.FREE_LIST_HEAD
      this.freeCountOffset = configBaseI32 + ZONE_CONFIG.FREE_COUNT

      // Initialize Return Queue for this zone
      this.returnQueue = new ReturnQueue(sab, zoneIndex, this.workerZones)

      // Initialize all Return Queues for cross-zone enqueue
      this.allReturnQueues = []
      let z = 0
      while (z < this.workerZones) {
        this.allReturnQueues[z] = new ReturnQueue(sab, z, this.workerZones)
        z = z + 1
      }
    }
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
   * In multi-zone mode, validates against this zone's bounds.
   */
  private isValidPtr(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return true // NULL is valid (means end)

    const i32Index = this.ptrToI32Index(ptr)

    // Check alignment (must be on node boundary)
    if ((i32Index - this.heapStartI32) % NODE_SIZE_I32 !== 0) {
      return false
    }

    if (this.zoneConfigOffset === -1) {
      // Legacy mode: validate against full heap
      const nodeIndex = (i32Index - this.heapStartI32) / NODE_SIZE_I32
      return nodeIndex >= 0 && nodeIndex < this.nodeCapacity
    } else {
      // Multi-zone mode: validate against this zone's bounds
      return i32Index >= this.zoneHeapStartI32 && i32Index < this.zoneHeapEndI32
    }
  }

  /**
   * Validate that a pointer is within the global heap bounds (any zone).
   * Used for cross-zone free validation.
   */
  private isValidGlobalPtr(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return false // NULL is not valid for cross-zone

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
   * RFC-056: Uses zone-specific header offsets in multi-zone mode.
   *
   * @returns Node pointer, or NULL_PTR if heap exhausted or corrupted
   *
   * @remarks
   * - SPSC INVARIANT: Only AudioWorklet thread may call this
   * - Zero-allocation: Uses error codes, not exceptions
   * - O(1) time complexity
   */
  alloc(): NodePtr {
    // MEMORY BARRIER: Atomics.load ensures visibility of head pointer
    // SPSC: No CAS needed - single producer/consumer guarantees no races.
    // A CAS loop here would add overhead without improving correctness under
    // the enforced single-writer contract (see class-level enforcement note).
    const head = Atomics.load(this.sab, this.freeListHeadOffset)

    // Heap exhausted - zero-allocation error path
    if (head === NULL_PTR) {
      return NULL_PTR
    }

    // Validate pointer before dereferencing (defensive programming)
    if (!this.isValidPtr(head)) {
      // ZERO-ALLOCATION: Set error flag instead of throwing
      Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return NULL_PTR
    }

    const headOffset = this.nodeOffset(head)

    // Read next pointer from free node's PACKED_A slot
    // MEMORY BARRIER: Ensures we see the value written during free()
    const next = Atomics.load(this.sab, headOffset + NODE.PACKED_A)

    // MEMORY BARRIER: Atomics.store ensures new head is visible
    // SPSC: No CAS needed - we're the only writer
    Atomics.store(this.sab, this.freeListHeadOffset, next)

    // Zero the node fields (except SEQ which tracks version)
    this.zeroNode(headOffset)

    // MEMORY BARRIER: Atomic decrement for cross-thread visibility
    Atomics.sub(this.sab, this.freeCountOffset, 1)

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
   *
   * RFC-056 Multi-Zone:
   * - If pointer belongs to this zone: local free (SPSC)
   * - If pointer belongs to another zone: enqueue to that zone's Return Queue
   */
  free(ptr: NodePtr): void {
    if (ptr === NULL_PTR) {
      return // Ignore null frees
    }

    // RFC-056: In multi-zone mode, check if this is a cross-zone free
    if (this.zoneConfigOffset !== -1) {
      const targetZone = this.getZoneForPtr(ptr)

      if (targetZone === -1) {
        // Invalid pointer (out of heap range)
        Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
        return
      }

      if (targetZone !== this.zoneIndex) {
        // Cross-zone free: enqueue to target zone's Return Queue
        this._enqueueToReturnQueue(ptr, targetZone)
        return
      }
    }

    // Local free (same zone or legacy mode)
    this._localFree(ptr)
  }

  /**
   * Local free implementation (SPSC, same zone).
   * Called directly for same-zone frees and from drainReturnQueue().
   *
   * @remarks
   * - SPSC INVARIANT: Only zone owner may call this
   * - Implements LIFO stack push operation
   * - SEQ counter increment invalidates stale references
   */
  private _localFree(ptr: NodePtr): void {
    if (!this.isValidPtr(ptr)) {
      // ZERO-ALLOCATION: Set error flag instead of throwing
      Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return
    }

    const offset = this.nodeOffset(ptr)

    // VERSIONING: Increment SEQ by 2 to preserve even-stable invariant.
    // Stable nodes must have even SEQ; odd is reserved for in-progress writes.
    // SEQ is upper 24 bits of SEQ_FLAGS (SEQ.SEQ_SHIFT = 8).
    // MEMORY BARRIER: Atomic add ensures visibility to readers
    Atomics.add(this.sab, offset + NODE.SEQ_FLAGS, 2 << SEQ.SEQ_SHIFT)

    // MEMORY BARRIER: Load current head with acquire semantics
    const head = Atomics.load(this.sab, this.freeListHeadOffset)

    // LIFO PUSH: Point freed node to current head
    // MEMORY BARRIER: Ensures next pointer is visible before head update
    Atomics.store(this.sab, offset + NODE.PACKED_A, head)

    // LINEARIZATION POINT: Make freed node the new head
    // SPSC: No CAS needed - single writer guarantee from SiliconSynapse
    // audio-context gating + command execution ownership.
    Atomics.store(this.sab, this.freeListHeadOffset, ptr)

    // MEMORY BARRIER: Atomic increment for cross-thread visibility
    Atomics.add(this.sab, this.freeCountOffset, 1)
  }

  /**
   * Enqueue a pointer to another zone's Return Queue (RFC-056).
   *
   * @param ptr - Node pointer to return
   * @param targetZone - Index of the zone that owns this pointer
   */
  private _enqueueToReturnQueue(ptr: NodePtr, targetZone: number): void {
    const targetQueue = this.allReturnQueues[targetZone]
    if (targetQueue) {
      const success = targetQueue.enqueue(ptr)
      if (!success) {
        // Return Queue full - this is a serious error in production
        // Set error flag but don't lose the pointer (it will leak)
        Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      }
    }
  }

  /**
   * Determine which zone a pointer belongs to (RFC-056).
   *
   * O(1) lookup using arithmetic (requires equal-sized zones).
   *
   * @param ptr - Node byte pointer

   * @returns Zone index (0+) if valid, -1 if out of heap range
   */
  getZoneForPtr(ptr: NodePtr): number {
    if (this.zoneConfigOffset === -1) {
      // Legacy mode: only zone 0 exists
      return this.isValidPtr(ptr) ? 0 : -1
    }

    // Multi-zone mode: calculate zone from pointer offset
    const offset = ptr - this.globalHeapStart
    if (offset < 0 || this.zoneSizeBytes === 0) {
      return -1
    }

    const zoneIndex = (offset / this.zoneSizeBytes) | 0 // Fast integer division

    if (zoneIndex < 0 || zoneIndex >= this.workerZones) {
      return -1 // Out of worker zones range
    }

    return zoneIndex
  }

  /**
   * Drain the Return Queue at the start of each poll() cycle (RFC-056).
   *
   * Processes all cross-zone frees that were enqueued by other workers.
   * Must be called by the zone owner before processing commands.
   *
   * In legacy mode (workerZones: 1), this is a no-op.
   */
  drainReturnQueue(): void {
    if (this.returnQueue === null) {
      return // Legacy mode: no Return Queue
    }

    // Drain all pending returns
    let ptr = this.returnQueue.dequeue()
    while (ptr !== NULL_PTR) {
      this._localFree(ptr)
      ptr = this.returnQueue.dequeue()
    }
  }

  /**
   * Get the current count of free nodes.
   * RFC-056: Uses zone-specific offset in multi-zone mode.
   */
  getFreeCount(): number {
    return Atomics.load(this.sab, this.freeCountOffset)
  }

  /**
   * Get the current count of allocated nodes.
   * Note: In multi-zone mode, this returns the global count, not zone-specific.
   */
  getNodeCount(): number {
    return Atomics.load(this.sab, HDR.NODE_COUNT)
  }

  /**
   * Check if the free list is empty.
   *
   * SPSC Implementation (RFC-055): Simple 32-bit load.
   * RFC-056: Uses zone-specific offset in multi-zone mode.
   */
  isEmpty(): boolean {
    return Atomics.load(this.sab, this.freeListHeadOffset) === NULL_PTR
  }

  /**
   * Get the zone index this FreeList manages.
   */
  getZoneIndex(): number {
    return this.zoneIndex
  }

  /**
   * Check if this FreeList is in legacy (single-zone) mode.
   */
  isLegacyMode(): boolean {
    return this.zoneConfigOffset === -1
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
  static initializeZone(
    sab: Int32Array,
    zoneIndex: number,
    heapStartBytes: number,
    heapEndBytes: number,
    zoneCapacity: number,
    zoneConfigOffset: number
  ): void {
    const heapStartI32 = heapStartBytes / 4
    const configBaseI32 = zoneConfigOffset / 4 + zoneIndex * ZONE_CONFIG_STRIDE

    // Link zone nodes into free list: node[i].PACKED_A = ptr to node[i+1]
    // Last node points to NULL_PTR
    let i = 0
    while (i < zoneCapacity) {
      const offset = heapStartI32 + i * NODE_SIZE_I32

      // Initialize SEQ_FLAGS with initial sequence number 0
      sab[offset + NODE.SEQ_FLAGS] = 0

      if (i < zoneCapacity - 1) {
        // Point to next node in this zone
        const nextOffset = heapStartI32 + (i + 1) * NODE_SIZE_I32
        const nextPtr = nextOffset * 4
        sab[offset + NODE.PACKED_A] = nextPtr
      } else {
        // Last node points to null
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

    // Set zone config fields
    const firstNodePtr = heapStartI32 * 4
    sab[configBaseI32 + ZONE_CONFIG.HEAP_START] = heapStartBytes
    sab[configBaseI32 + ZONE_CONFIG.HEAP_END] = heapEndBytes
    Atomics.store(sab, configBaseI32 + ZONE_CONFIG.FREE_LIST_HEAD, firstNodePtr)
    sab[configBaseI32 + ZONE_CONFIG.FREE_COUNT] = zoneCapacity
    sab[configBaseI32 + ZONE_CONFIG.NODE_COUNT] = 0
    sab[configBaseI32 + ZONE_CONFIG.NODE_CAPACITY] = zoneCapacity
    sab[configBaseI32 + ZONE_CONFIG.OWNER_ID] = 0 // Unclaimed
    sab[configBaseI32 + ZONE_CONFIG.RESERVED] = 0
    // Return Queue head/tail initialized by ReturnQueue.initialize()
  }
}
