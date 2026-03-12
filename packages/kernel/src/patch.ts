// =============================================================================
// SymphonyScript - Silicon Linker Attribute Patching (RFC-043)
// =============================================================================
// Immediate attribute patching with SEQ counter updates for ABA protection.

import {
  NODE,
  NODE_SIZE_I32,
  PACKED,
  SEQ,
  FLAG,
  CONCURRENCY,
  HDR,
  ERROR,
  NULL_PTR,
  HEAP_START_OFFSET
} from './constants'
import type { NodePtr } from './types'
// RFC-045-04: InvalidPointerError no longer thrown - using boolean returns

/**
 * Attribute patcher for immediate, sub-millisecond node updates.
 *
 * These operations:
 * - Do NOT require COMMIT_FLAG (consumer sees changes on next read)
 * - DO increment SEQ counter for ABA protection
 * - Are atomic at the individual field level
 *
 * Thread safety:
 * - Each patch is a single Atomics.store (atomic for aligned i32)
 * - SEQ increment ensures consumer detects the change
 */
export class AttributePatcher {
  private sab: Int32Array
  private heapStartI32: number
  private nodeCapacity: number

  constructor(sab: Int32Array, nodeCapacity: number) {
    this.sab = sab
    this.heapStartI32 = HEAP_START_OFFSET / 4
    this.nodeCapacity = nodeCapacity
  }

  /**
   * Convert a byte pointer to i32 index within the SAB.
   */
  private ptrToI32Index(ptr: NodePtr): number {
    return ptr / 4
  }

  /**
   * Get the i32 offset for a node given its byte pointer.
   */
  nodeOffset(ptr: NodePtr): number {
    return this.ptrToI32Index(ptr)
  }

  /**
   * Validate that a pointer is within the heap bounds and properly aligned.
   * RFC-045-04: Returns false instead of throwing.
   */
  private validatePtr(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) {
      return false
    }

    const i32Index = this.ptrToI32Index(ptr)
    const nodeIndex = (i32Index - this.heapStartI32) / NODE_SIZE_I32

    if (
      nodeIndex < 0 ||
      nodeIndex >= this.nodeCapacity ||
      (i32Index - this.heapStartI32) % NODE_SIZE_I32 !== 0
    ) {
      return false
    }
    return true
  }

  /**
   * Increment the SEQ counter for ABA protection.
   * Called before any attribute mutation.
   *
   * Uses a CAS loop to increment only the upper 24 SEQ bits while
   * preserving the lower 8 FLAGS_EXT bits across the 0xFFFFFF→0 wraparound.
   * A naive Atomics.add(1 << SEQ_SHIFT) would overflow Int32 and clear FLAGS_EXT.
   */
  private bumpSeq(offset: number): void {
    const idx = offset + NODE.SEQ_FLAGS
    let old: number
    let next: number
    do {
      old = Atomics.load(this.sab, idx)
      const seq = ((old >>> SEQ.SEQ_SHIFT) + 1) & 0xFFFFFF
      next = (old & SEQ.FLAGS_EXT_MASK) | (seq << SEQ.SEQ_SHIFT)
    } while (Atomics.compareExchange(this.sab, idx, old, next) !== old)
  }

  /**
   * Atomically patch a field within PACKED_A using CAS loop.
   * Task 3.4: Prevents lost updates if multiple threads patch concurrently.
   *
   * @param offset - Node i32 offset
   * @param mask - Bit mask for the field
   * @param shift - Bit shift for the field
   * @param value - New value to set (will be shifted and masked)
   */
  private casUpdatePackedA(
    offset: number,
    mask: number,
    shift: number,
    value: number
  ): void {
    let attempts = 0
    while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
      const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
      const newPacked = (current & ~mask) | ((value << shift) & mask)

      if (newPacked === current) {
        return // No change needed
      }

      const result = Atomics.compareExchange(
        this.sab,
        offset + NODE.PACKED_A,
        current,
        newPacked
      )

      if (result === current) {
        return // CAS succeeded
      }
      attempts = attempts + 1
    }
    Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
  }

  /**
   * Atomically set bits in PACKED_A using bounded CAS retries.
   *
   * @param offset - Node i32 offset
   * @param flag - Bitmask to set
   */
  private casSetFlag(offset: number, flag: number): void {
    let attempts = 0
    while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
      const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
      const newPacked = current | flag

      if (newPacked === current) {
        return // No change needed
      }

      const result = Atomics.compareExchange(
        this.sab,
        offset + NODE.PACKED_A,
        current,
        newPacked
      )

      if (result === current) {
        return // CAS succeeded
      }
      attempts = attempts + 1
    }
    Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
  }

  /**
   * Atomically clear bits in PACKED_A using bounded CAS retries.
   *
   * @param offset - Node i32 offset
   * @param flag - Bitmask to clear
   */
  private casClearFlag(offset: number, flag: number): void {
    let attempts = 0
    while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
      const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
      const newPacked = current & ~flag

      if (newPacked === current) {
        return // No change needed
      }

      const result = Atomics.compareExchange(
        this.sab,
        offset + NODE.PACKED_A,
        current,
        newPacked
      )

      if (result === current) {
        return // CAS succeeded
      }
      attempts = attempts + 1
    }
    Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
  }

  /**
   * Patch the pitch attribute (bits 16-23 of PACKED_A).
   * RFC-045-04: Returns boolean instead of throwing.
   * Task 3.4: Uses CAS loop for atomic read-modify-write.
   *
   * @param ptr - Node byte pointer
   * @param pitch - New pitch value (0-127)
   * @returns true on success, false on invalid pointer
   */
  patchPitch(ptr: NodePtr, pitch: number): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Clamp pitch to valid MIDI range
    pitch = Math.max(0, Math.min(127, pitch | 0))

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    // Task 3.4: CAS loop for atomic PACKED_A update
    this.casUpdatePackedA(offset, PACKED.PITCH_MASK, PACKED.PITCH_SHIFT, pitch)
    return true
  }

  /**
   * Patch the velocity attribute (bits 8-15 of PACKED_A).
   * RFC-045-04: Returns boolean instead of throwing.
   * Task 3.4: Uses CAS loop for atomic read-modify-write.
   *
   * @param ptr - Node byte pointer
   * @param velocity - New velocity value (0-127)
   * @returns true on success, false on invalid pointer
   */
  patchVelocity(ptr: NodePtr, velocity: number): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Clamp velocity to valid MIDI range
    velocity = Math.max(0, Math.min(127, velocity | 0))

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    // Task 3.4: CAS loop for atomic PACKED_A update
    this.casUpdatePackedA(offset, PACKED.VELOCITY_MASK, PACKED.VELOCITY_SHIFT, velocity)
    return true
  }

  /**
   * Patch the duration attribute.
   * RFC-045-04: Returns boolean instead of throwing.
   *
   * @param ptr - Node byte pointer
   * @param duration - New duration in ticks
   * @returns true on success, false on invalid pointer
   */
  patchDuration(ptr: NodePtr, duration: number): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Ensure duration is non-negative integer
    duration = Math.max(0, duration | 0)

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    // Direct write to DURATION field
    Atomics.store(this.sab, offset + NODE.DURATION, duration)
    return true
  }

  /**
   * Patch the base tick attribute.
   * RFC-045-04: Returns boolean instead of throwing.
   *
   * @param ptr - Node byte pointer
   * @param baseTick - New base tick (grid-aligned timing)
   * @returns true on success, false on invalid pointer
   */
  patchBaseTick(ptr: NodePtr, baseTick: number): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Ensure baseTick is non-negative integer
    baseTick = Math.max(0, baseTick | 0)

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    // Direct write to BASE_TICK field
    Atomics.store(this.sab, offset + NODE.BASE_TICK, baseTick)
    return true
  }

  /**
   * Set or clear the MUTED flag.
   * RFC-045-04: Returns boolean instead of throwing.
   * Task 3.4: Uses CAS loop for atomic read-modify-write.
   *
   * @param ptr - Node byte pointer
   * @param muted - Whether the node should be muted
   * @returns true on success, false on invalid pointer
   */
  patchMuted(ptr: NodePtr, muted: boolean): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    if (muted) {
      this.casSetFlag(offset, FLAG.MUTED)
    } else {
      this.casClearFlag(offset, FLAG.MUTED)
    }
    return true
  }

  /**
   * Patch the source ID (editor location hash).
   * RFC-045-04: Returns boolean instead of throwing.
   *
   * @param ptr - Node byte pointer
   * @param sourceId - New source ID
   * @returns true on success, false on invalid pointer
   */
  patchSourceId(ptr: NodePtr, sourceId: number): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    // Bump SEQ for ABA protection
    this.bumpSeq(offset)

    // Direct write to SOURCE_ID field
    Atomics.store(this.sab, offset + NODE.SOURCE_ID, sourceId | 0)
    return true
  }

  /**
   * Patch multiple whole i32 fields in a single SEQ bump (Task 074).
   *
   * Each offset/value pair writes directly via Atomics.store.
   * For PACKED_A sub-fields (pitch, velocity, muted), use the
   * individual patchPitch/patchVelocity/patchMuted methods instead.
   *
   * @param ptr - Node byte pointer
   * @param o1 - First field offset (NODE.* constant)
   * @param v1 - First field value
   * @param o2 - Second field offset
   * @param v2 - Second field value
   * @param o3 - Third field offset
   * @param v3 - Third field value
   * @param o4 - Fourth field offset
   * @param v4 - Fourth field value
   * @param count - Number of active offset/value pairs (1-4)
   * @returns true on success, false on invalid pointer
   */
  patchMultiple(
    ptr: NodePtr,
    o1: number, v1: number,
    o2: number, v2: number,
    o3: number, v3: number,
    o4: number, v4: number,
    count: number
  ): boolean {
    if (!this.validatePtr(ptr)) return false
    const offset = this.nodeOffset(ptr)

    this.bumpSeq(offset)

    if (count >= 1) Atomics.store(this.sab, offset + o1, v1)
    if (count >= 2) Atomics.store(this.sab, offset + o2, v2)
    if (count >= 3) Atomics.store(this.sab, offset + o3, v3)
    if (count >= 4) Atomics.store(this.sab, offset + o4, v4)

    return true
  }

}
