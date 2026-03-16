// =============================================================================
// SymphonyScript - Return Queue (RFC-056 Multi-Zone)
// =============================================================================
// MPSC (Multi-Producer Single-Consumer) ring buffer for cross-zone frees.
// Multiple workers can enqueue (producers), one worker drains (consumer).
//
// INVARIANT: Only the zone owner may call dequeue().
// Any worker may call enqueue() to return a node to another zone.

import {
  HDR,
  ZONE_CONFIG,
  ZONE_CONFIG_STRIDE,
  RETURN_QUEUE_CAPACITY,
  getReturnQueueForZone,
  NULL_PTR,
  ZONE_ERR
} from './constants'
import type { NodePtr } from './types'

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
export class ReturnQueue {
  private sab: Int32Array
  private zoneIndex: number
  private workerZones: number
  private headOffset: number // i32 index of RETURN_QUEUE_HEAD in zone config
  private tailOffset: number // i32 index of RETURN_QUEUE_TAIL in zone config
  private bufferOffset: number // i32 index of buffer start

  /**
   * Create a ReturnQueue instance for a specific zone.
   *
   * @param sab - Int32Array view of SharedArrayBuffer
   * @param zoneIndex - Index of the zone this queue belongs to
   * @param workerZones - Total number of worker zones
   */
  constructor(sab: Int32Array, zoneIndex: number, workerZones: number) {
    this.sab = sab
    this.zoneIndex = zoneIndex
    this.workerZones = workerZones

    // Read zone config offset from header
    const zoneConfigOffsetBytes = sab[HDR.ZONE_CONFIG_OFFSET]
    const zoneConfigOffset = zoneConfigOffsetBytes / 4 // i32 index
    const configBase = zoneConfigOffset + zoneIndex * ZONE_CONFIG_STRIDE

    this.headOffset = configBase + ZONE_CONFIG.RETURN_QUEUE_HEAD
    this.tailOffset = configBase + ZONE_CONFIG.RETURN_QUEUE_TAIL

    // Calculate buffer offset
    const bufferByteOffset = getReturnQueueForZone(zoneConfigOffsetBytes, workerZones, zoneIndex)
    this.bufferOffset = bufferByteOffset / 4 // i32 index
  }

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
  enqueue(ptr: NodePtr): boolean {
    let retries = 0
    const maxRetries = 100 // Prevent infinite loop under extreme contention

    while (retries < maxRetries) {
      // MEMORY BARRIER: Atomics.load ensures we see the latest head value
      // published by other producers (acquire semantics)
      const head = Atomics.load(this.sab, this.headOffset)
      const next = (head + 1) & (RETURN_QUEUE_CAPACITY - 1) // Power-of-2 wrap

      // Check if queue is full (linearization point for full detection)
      const tail = Atomics.load(this.sab, this.tailOffset)
      if (next === tail) {
        return false // Queue full
      }

      // CRITICAL: Write ptr BEFORE claiming the slot (avoids read-before-write race)
      // If CAS fails, our write is harmless (will be overwritten by winner)
      // MEMORY BARRIER: Atomics.store ensures visibility to consumer
      Atomics.store(this.sab, this.bufferOffset + head, ptr)

      // LINEARIZATION POINT: CAS is the atomic commit operation
      // If CAS succeeds, we own the slot and ptr is visible to consumer
      const result = Atomics.compareExchange(this.sab, this.headOffset, head, next)
      if (result === head) {
        return true // Successfully enqueued
      }

      // CAS failed, another producer won - retry with fresh head value
      retries = retries + 1
    }

    // Extreme contention - treat as full (zero-allocation: no error thrown)
    return false
  }

  /**
   * Dequeue a pointer from this zone's Return Queue (SPSC consumer).
   *
   * Only the zone owner should call this method.
   * No atomics needed for tail advancement (single consumer).
   *
   * @returns Node pointer if available, NULL_PTR if queue is empty
   */
  dequeue(): NodePtr {
    // SPSC INVARIANT: Only zone owner calls dequeue(), so tail read is safe
    const tail = this.sab[this.tailOffset]
    
    // MEMORY BARRIER: Atomics.load ensures we see latest head from producers
    const head = Atomics.load(this.sab, this.headOffset)

    if (tail === head) {
      return NULL_PTR // Queue empty
    }

    // MEMORY BARRIER: Atomics.load ensures we see the ptr written by producer
    // (producer used Atomics.store before CAS, so this is safe)
    const ptr = Atomics.load(this.sab, this.bufferOffset + tail)

    // SPSC: Single consumer, no atomics needed for tail write
    // Other producers only read tail to check fullness (benign race)
    this.sab[this.tailOffset] = (tail + 1) & (RETURN_QUEUE_CAPACITY - 1)

    return ptr
  }

  /**
   * Check if the Return Queue is empty.
   *
   * @returns true if empty, false if there are items to dequeue
   */
  isEmpty(): boolean {
    const tail = this.sab[this.tailOffset]
    const head = Atomics.load(this.sab, this.headOffset)
    return tail === head
  }

  /**
   * Get the number of items currently in the queue.
   *
   * Note: This is approximate under concurrent access.
   *
   * @returns Number of items in queue
   */
  getCount(): number {
    const tail = this.sab[this.tailOffset]
    const head = Atomics.load(this.sab, this.headOffset)
    return (head - tail + RETURN_QUEUE_CAPACITY) & (RETURN_QUEUE_CAPACITY - 1)
  }

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
  static initialize(sab: Int32Array, zoneIndex: number, workerZones: number): void {
    // Read zone config offset from header
    const zoneConfigOffsetBytes = sab[HDR.ZONE_CONFIG_OFFSET]
    const zoneConfigOffset = zoneConfigOffsetBytes / 4
    const configBase = zoneConfigOffset + zoneIndex * ZONE_CONFIG_STRIDE

    // Initialize head and tail to 0 (empty queue)
    Atomics.store(sab, configBase + ZONE_CONFIG.RETURN_QUEUE_HEAD, 0)
    sab[configBase + ZONE_CONFIG.RETURN_QUEUE_TAIL] = 0

    // Buffer is already zero-initialized by SharedArrayBuffer spec
    // No need to explicitly zero it
  }
}
