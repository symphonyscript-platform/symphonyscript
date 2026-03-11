// =============================================================================
// SymphonyScript - Silicon Linker (RFC-043)
// =============================================================================
// Main Silicon Linker implementation - Memory Management Unit for the SAB.

import {
  HDR,
  REG,
  NODE,
  COMMIT,
  ERROR,
  DEBUG,
  NULL_PTR,
  PACKED,
  SEQ,
  FLAG,
  NODE_SIZE_I32,
  HEAP_START_OFFSET,
  CONCURRENCY,
  ID_TABLE,
  SYM_TABLE,
  getSymbolTableOffset,
  getZoneSplitIndex, // K-005
  getRingBufferOffset,
  DEFAULT_RING_CAPACITY,
  CMD,
  SYNAPSE_TABLE,
  SYNAPSE,
  getSynapseTableOffset,
  KNUTH_HASH_CONST,
  ZONE_CONFIG,
  ZONE_CONFIG_STRIDE,
  getZoneConfigTableOffset
} from './constants'
import { FreeList } from './free-list'
import { AttributePatcher } from './patch'
import { RingBuffer } from './ring-buffer'
import { SynapseAllocator } from './synapse-allocator'
import { createLinkerSAB, resetLinkerSAB } from './init'
import type {
  NodePtr,
  LinkerConfig,
  ISiliconLinker
} from './types'
// RFC-045-04: Error classes no longer thrown - using error codes instead

/**
 * Modular distance check for 24-bit SEQ counter wraparound (Task 071).
 *
 * Uses TCP-style sequence number arithmetic: if the counter wrapped a full
 * half-cycle (2^23 increments) during a single read, the distance check
 * catches it even when before === after by coincidence.
 *
 * @param before - SEQ value read before the data fields
 * @param after - SEQ value read after the data fields
 * @returns true if the sequence changed (read is inconsistent), false if consistent
 */
export function seqChanged(before: number, after: number): boolean {
  return before !== after || ((after - before) & 0xFFFFFF) >= SEQ.SEQ_HALF
}

export function unpackOpcode(packed: number): number {
  return (packed & PACKED.OPCODE_MASK) >>> PACKED.OPCODE_SHIFT
}

export function unpackPitch(packed: number): number {
  return (packed & PACKED.PITCH_MASK) >>> PACKED.PITCH_SHIFT
}

export function unpackVelocity(packed: number): number {
  return (packed & PACKED.VELOCITY_MASK) >>> PACKED.VELOCITY_SHIFT
}

export function unpackFlags(packed: number): number {
  return packed & PACKED.FLAGS_MASK
}

export function unpackSeq(seqFlags: number): number {
  return (seqFlags & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT
}

/**
 * Silicon Linker - Memory Management Unit for Direct-to-Silicon Mirroring.
 *
 * This class acts as the sole authority for memory allocation and pointer
 * manipulation within the SharedArrayBuffer. It implements:
 *
 * - Lock-free free list for node allocation/deallocation
 * - Immediate attribute patching (<0.001ms)
 * - Structural splicing with safe zone enforcement
 * - COMMIT_FLAG protocol for consumer synchronization
 *
 * Thread safety model:
 * - Silicon Linker runs in a dedicated Web Worker
 * - AudioWorklet consumer reads from SAB
 * - All shared state accessed via Atomics
 */
export class SiliconSynapse implements ISiliconLinker {
  private sab: Int32Array
  private sab64: BigInt64Array
  private buffer: SharedArrayBuffer
  private freeList: FreeList
  private patcher: AttributePatcher
  private ringBuffer: RingBuffer
  private heapStartI32: number
  private nodeCapacity: number
  private zoneBStartPtr: number // K-005: For identifying Zone B nodes

  // RFC-044: Command processing state
  private commandBuffer: Int32Array // Pre-allocated buffer for reading commands

  // [RFC-054] Synapse Allocator for CMD.CONNECT/DISCONNECT (injected by SiliconBridge)
  private synapseAllocator: SynapseAllocator | null = null

  // RFC-045-04: Context-aware mutex behavior
  private isAudioContext: boolean = false

  // Task 3.3: Detect Atomics.wait support once at construction (not in hot path)
  // Workers support it, main thread throws TypeError
  private readonly canAtomicsWait: boolean

  // RFC-056: Multi-zone support
  private zoneIndex: number

  /**
   * Create a new Silicon Linker.
   *
   * @param buffer - Initialized SharedArrayBuffer (use createLinkerSAB)
   * @param zoneIndex - Zone index for multi-zone mode (default: 0)
   */
  constructor(buffer: SharedArrayBuffer, zoneIndex: number = 0) {
    this.buffer = buffer
    this.sab = new Int32Array(buffer)
    this.sab64 = new BigInt64Array(buffer)
    this.heapStartI32 = HEAP_START_OFFSET / 4
    // M-002: Use Atomics.load for thread-safe header access
    this.nodeCapacity = Atomics.load(this.sab, HDR.NODE_CAPACITY)
    this.zoneIndex = zoneIndex

    // Calculate Zone B start pointer (byte offset) for reclamation check
    // Formula: HEAP_START + (Index * 32)
    // Note: heapStartI32 is in ints, we need bytes for consistency or use mixed math
    const zoneSplitIndex = getZoneSplitIndex(this.nodeCapacity)
    this.zoneBStartPtr = (this.heapStartI32 * 4) + (zoneSplitIndex * 32) // 32 = NODE_SIZE_BYTES

    // RFC-055/RFC-056: Initialize FreeList with zone parameters
    const workerZones = Atomics.load(this.sab, HDR.ZONE_COUNT) || 1
    const zoneConfigOffset = Atomics.load(this.sab, HDR.ZONE_CONFIG_OFFSET)

    if (workerZones === 1 || zoneConfigOffset === 0) {
      // Legacy mode: single-zone FreeList
      this.freeList = new FreeList(this.sab)
    } else {
      // Multi-zone mode: zone-specific FreeList
      this.freeList = new FreeList(this.sab, zoneIndex, zoneConfigOffset)
    }

    this.patcher = new AttributePatcher(this.sab, this.nodeCapacity)

    // RFC-044: Initialize Command Ring Buffer infrastructure
    this.ringBuffer = new RingBuffer(this.sab)
    this.commandBuffer = new Int32Array(4) // Pre-allocate for zero-alloc reads

    // Task 3.3: Detect Atomics.wait support ONCE at construction (not in hot path)
    this.canAtomicsWait = this._detectAtomicsWaitSupport()
  }

  /**
   * Detect if Atomics.wait is supported in this context.
   *
   * Called once at construction time. Workers support Atomics.wait,
   * main thread throws TypeError. This detection allows zero-allocation
   * hot path by avoiding try/catch in _yieldToCPU().
   *
   * @returns true if Atomics.wait is available
   */
  private _detectAtomicsWaitSupport(): boolean {
    try {
      // Use a dummy test with immediate timeout
      // Value -1 ensures "not-equal" return (no actual wait)
      Atomics.wait(this.sab, HDR.YIELD_SLOT, -1, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the underlying SharedArrayBuffer.
   */


  /**
   * Create a Silicon Linker with a new SAB.
   *
   * RFC-058: Returns null if configuration is invalid (zero-allocation error handling).
   *
   * @param config - Optional configuration overrides
   * @returns New SiliconSynapse instance, or null if config is invalid
   *
   * @remarks
   * - synapseCapacity must be a power of 2
   * - workerZones must be between 1 and 8
   * - Caller must check for null return
   *
   * @example
   * ```typescript
   * const linker = SiliconSynapse.create({ nodeCapacity: 4096 })
   * if (linker === null) {
   *   console.error('Invalid configuration')
   *   return
   * }
   * ```
   */
  static create(config?: LinkerConfig): SiliconSynapse | null {
    const buffer = createLinkerSAB(config)
    if (buffer === null) {
      return null // Invalid config - caller must handle
    }
    return new SiliconSynapse(buffer)
  }

  /**
   * Create a SiliconSynapse for a specific zone in an existing multi-zone SAB (RFC-056).
   *
   * Used when multiple workers share a SAB and each claims a zone.
   * The worker ID is used to atomically claim an unclaimed zone via CAS.
   *
   * @param sab - Existing SharedArrayBuffer (already initialized with workerZones > 1)
   * @param workerId - Unique worker ID (must be > 0, used for zone claiming)
   * @returns SiliconSynapse on success, null if no zones available
   */
  static createForZone(sab: SharedArrayBuffer, workerId: number): SiliconSynapse | null {
    const view = new Int32Array(sab)
    const workerZones = Atomics.load(view, HDR.ZONE_COUNT)

    if (workerZones <= 1) {
      // Legacy mode - use standard constructor (zone 0, no claiming needed)
      return new SiliconSynapse(sab)
    }

    // Multi-zone mode - claim a zone via atomic CAS
    const zoneIndex = SiliconSynapse._claimZone(view, workerId)
    if (zoneIndex === -1) {
      return null // No zones available
    }

    return new SiliconSynapse(sab, zoneIndex)
  }

  /**
   * Claim a zone for this worker using atomic CAS (RFC-056).
   *
   * Iterates through all zones and attempts to claim the first unclaimed one
   * by atomically setting OWNER_ID from 0 to workerId.
   *
   * @param sab - Int32Array view of SharedArrayBuffer
   * @param workerId - Unique worker ID (must be > 0)
   * @returns Zone index (0+) on success, -1 if no zones available
   */
  private static _claimZone(sab: Int32Array, workerId: number): number {
    const zoneCount = Atomics.load(sab, HDR.ZONE_COUNT)
    const zoneConfigOffset = Atomics.load(sab, HDR.ZONE_CONFIG_OFFSET)

    if (zoneConfigOffset === 0) {
      return -1 // Legacy mode, no zone claiming
    }

    const configBaseI32 = zoneConfigOffset / 4

    let i = 0
    while (i < zoneCount) {
      const ownerOffset = configBaseI32 + i * ZONE_CONFIG_STRIDE + ZONE_CONFIG.OWNER_ID

      // Atomic claim: CAS from 0 (unclaimed) to workerId
      const result = Atomics.compareExchange(sab, ownerOffset, 0, workerId)

      if (result === 0) {
        return i // Successfully claimed zone i
      }

      i = i + 1
    }

    return -1 // No zones available
  }

  /**
   * Get the zone index this SiliconSynapse is operating on (RFC-056).
   *
   * @returns Zone index (0 in legacy mode)
   */
  getZoneIndex(): number {
    return this.zoneIndex
  }

  /**
   * Inject a SynapseAllocator instance (Task 072: Singleton ownership by SiliconBridge).
   *
   * SiliconBridge owns the sole SynapseAllocator and injects it here so that
   * CMD.CONNECT / CMD.DISCONNECT / compaction all operate on the same instance.
   * When no allocator is set, synapse operations become no-ops returning error codes.
   */
  setSynapseAllocator(allocator: SynapseAllocator): void {
    this.synapseAllocator = allocator
  }

  // ===========================================================================
  // RFC-045-04: Context-Aware Execution
  // ===========================================================================

  /**
   * Set execution context for mutex behavior (RFC-045-04).
   *
   * **CRITICAL:** Call `setAudioContext(true)` from AudioWorklet.process() entry
   * to enable audio-safe try-lock behavior. Call `setAudioContext(false)` on exit.
   *
   * **Audio Context Behavior:**
   * - Maximum 3 CAS attempts (~300ns)
   * - Immediate return false on contention (no blocking)
   * - No kernel panic (contention is acceptable, retry next block)
   *
   * **Main Thread Behavior:**
   * - Full spin-wait with yield (up to 200 iterations with 1ms yields)
   * - Kernel panic on exhaustion (deadlock detected)
   *
   * @param isAudio - true if called from AudioWorklet context
   */
  setAudioContext(isAudio: boolean): void {
    this.isAudioContext = isAudio
  }

  /**
   * Get current execution context flag.
   *
   * @returns true if currently in audio context, false otherwise
   *
   * @remarks
   * This flag controls mutex behavior:
   * - `true`: Audio-safe mode (max 3 spins, no yield, no panic)
   * - `false`: Main thread mode (full spin-wait with yield)
   *
   * @see setAudioContext - Set the context flag
   * @see poll - Automatically manages context for audio thread
   */
  getAudioContext(): boolean {
    return this.isAudioContext
  }

  // ===========================================================================
  // Chain Mutex (v1.5) - Concurrency Control
  // ===========================================================================

  /**
   * Zero-allocation CPU yield for worker context.
   *
   * Uses Atomics.wait() with 1ms timeout to sleep without allocating memory.
   * Task 3.3: Support detected once at construction — no try/catch in hot path.
   *
   * @remarks
   * This is a synchronous sleep that doesn't create Promise garbage.
   * The 1ms timeout allows other threads to acquire the mutex.
   * On main thread: no-op (spin continues without yield) — acceptable for rare mutex use.
   */
  private _yieldToCPU(): void {
    // Task 3.3: Only call Atomics.wait if supported (detected at construction)
    // Hot path is ZERO-ALLOC: simple boolean check, no try/catch
    if (this.canAtomicsWait) {
      Atomics.wait(this.sab, HDR.YIELD_SLOT, 0, 1)
    }
    // On main thread: no-op — spin continues without yield
    // This is acceptable because main thread mutex acquisition is rare
  }

  /**
   * Increment 64-bit telemetry counter with proper carry handling (RFC-044 Decree 044-09).
   *
   * Atomically increments the 64-bit operation counter stored across
   * TELEMETRY_OPS_LOW and TELEMETRY_OPS_HIGH registers.
   *
   * **Carry Protocol**:
   * 1. Increment LOW register atomically
   * 2. If LOW register wrapped to 0, increment HIGH register
   * 3. Race condition on wrap is acceptable (undercounting by 1 is tolerable)
   *
   * **Performance**: Single-threaded increment is ~2ns, contended case is ~50ns.
   */
  private _incrementTelemetry(): void {
    // Atomically increment LOW register and get the new value
    const newLow = Atomics.add(this.sab, HDR.TELEMETRY_OPS_LOW, 1) + 1

    // If LOW wrapped around to 0, increment HIGH register (carry bit)
    // NOTE: There's a race condition where multiple threads could detect wrap
    // simultaneously, causing HIGH to increment multiple times. However,
    // this is acceptable for telemetry - we prioritize lock-free performance
    // over perfect accuracy at the 2^32 boundary.
    if (newLow === 0) {
      Atomics.add(this.sab, HDR.TELEMETRY_OPS_HIGH, 1)
    }
  }

  /**
   * Context-aware mutex acquisition (RFC-045-04 ISSUE-001).
   *
   * **Audio Context** (isAudioContext = true):
   * - Maximum AUDIO_SAFE_MAX_SPINS (3) CAS attempts (~300ns total)
   * - Immediate return false on contention (no blocking)
   * - No kernel panic (contention is acceptable, retry next audio block)
   *
   * **Main Thread Context** (isAudioContext = false):
   * - Full spin-wait with yield (up to MUTEX_PANIC_THRESHOLD × YIELD_AFTER_SPINS)
   * - Kernel panic on exhaustion (deadlock detected, sets ERROR_FLAG)
   *
   * @returns true if acquired, false if contention (audio) or deadlock (main)
   */
  private _acquireChainMutex(): boolean {
    // Determine max spins based on execution context
    const maxSpins = this.isAudioContext
      ? CONCURRENCY.AUDIO_SAFE_MAX_SPINS
      : CONCURRENCY.MUTEX_PANIC_THRESHOLD * (CONCURRENCY.YIELD_AFTER_SPINS + 1)

    let spins = 0
    let yieldCounter = 0

    while (spins < maxSpins) {
      // Attempt CAS: 0 → 1
      const prev = Atomics.compareExchange(
        this.sab,
        HDR.CHAIN_MUTEX,
        CONCURRENCY.MUTEX_UNLOCKED,
        CONCURRENCY.MUTEX_LOCKED
      )

      if (prev === CONCURRENCY.MUTEX_UNLOCKED) {
        return true // Successfully acquired
      }

      spins = spins + 1

      // Only yield in non-audio context (blocking is forbidden in audio thread)
      if (!this.isAudioContext) {
        yieldCounter = yieldCounter + 1
        if (yieldCounter > CONCURRENCY.YIELD_AFTER_SPINS) {
          this._yieldToCPU()
          yieldCounter = 0
        }
      }
    }

    // Contention handling:
    // - Audio context: Return false (acceptable, retry next block)
    // - Main context: Kernel panic (deadlock detected)
    if (!this.isAudioContext) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.KERNEL_PANIC)
    }

    return false
  }

  /**
   * Release the Chain Mutex.
   *
   * This must ALWAYS be called after acquiring the mutex, even if an error occurs.
   * Use try-finally pattern to ensure release.
   */
  private _releaseChainMutex(): void {
    // Release lock: 1 → 0
    Atomics.store(this.sab, HDR.CHAIN_MUTEX, CONCURRENCY.MUTEX_UNLOCKED)
  }

  // ===========================================================================
  // Public Mutex Access (for thread-safe compaction)
  // ===========================================================================

  /**
   * Acquire Chain Mutex (public wrapper for thread-safe operations).
   * 
   * **Use Case:** Enables thread-safe Synapse Table compaction via
   * `synapseAllocator.compactTableSafe(linker.acquireMutex, linker.releaseMutex)`
   * 
   * **WARNING:** Always pair with `releaseMutex()` using try-finally pattern.
   * 
   * @returns true if acquired, false if contention (audio) or deadlock (main)
   */
  acquireMutex(): boolean {
    return this._acquireChainMutex()
  }

  /**
   * Release Chain Mutex (public wrapper for thread-safe operations).
   * 
   * **WARNING:** Must ALWAYS be called after `acquireMutex()` returns true.
   */
  releaseMutex(): void {
    this._releaseChainMutex()
  }

  // ===========================================================================
  // RFC-044: Low-Level Linking Helpers
  // ===========================================================================

  /**
   * Link an existing node into the chain after a given node (RFC-044).
   *
   * **CRITICAL:** This method assumes:
   * - Chain Mutex is already acquired by caller
   * - Node data is already written to SAB
   * - newPtr points to a valid, initialized node
   * - afterPtr points to a valid node in the chain
   *
   * This is the extracted linking logic from insertNode(), used by both
   * the old insertNode() method and the new RFC-044 executeInsert().
   *
   * @param newPtr - Pointer to node to link (already allocated and written)
   * @param afterPtr - Pointer to node to insert after
   */
  private _linkNode(newPtr: NodePtr, afterPtr: NodePtr): void {
    const newOffset = this.nodeOffset(newPtr)
    const afterOffset = this.nodeOffset(afterPtr)

    // 1. Link Future: newNode.NEXT_PTR = afterNode.NEXT_PTR, newNode.PREV_PTR = afterPtr
    const nextPtr = Atomics.load(this.sab, afterOffset + NODE.NEXT_PTR)
    Atomics.store(this.sab, newOffset + NODE.NEXT_PTR, nextPtr)
    Atomics.store(this.sab, newOffset + NODE.PREV_PTR, afterPtr)

    // 2. Update nextNode.PREV_PTR = newPtr (if nextNode exists)
    if (nextPtr !== NULL_PTR) {
      const nextOffset = this.nodeOffset(nextPtr)
      Atomics.store(this.sab, nextOffset + NODE.PREV_PTR, newPtr)
    }

    // 3. Atomic Splice: afterNode.NEXT_PTR = newPtr
    Atomics.store(this.sab, afterOffset + NODE.NEXT_PTR, newPtr)

    // 4. Signal structural change
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)
  }

  /**
   * Link an existing node at the head of the chain (RFC-044).
   *
   * **CRITICAL:** This method assumes:
   * - Chain Mutex is already acquired by caller
   * - Node data is already written to SAB
   * - newPtr points to a valid, initialized node
   *
   * This is the extracted linking logic from insertHead(), used by both
   * the old insertHead() method and the new RFC-044 executeInsert().
   *
   * @param newPtr - Pointer to node to link (already allocated and written)
   */
  private _linkHead(newPtr: NodePtr): void {
    const newOffset = this.nodeOffset(newPtr)

    // 1. Load current head
    const currentHead = Atomics.load(this.sab, HDR.HEAD_PTR)

    // 2. Link new node to current head
    Atomics.store(this.sab, newOffset + NODE.NEXT_PTR, currentHead)
    Atomics.store(this.sab, newOffset + NODE.PREV_PTR, NULL_PTR) // New head has no prev

    // 3. Update old head's PREV_PTR to point to new head
    if (currentHead !== NULL_PTR) {
      const currentHeadOffset = this.nodeOffset(currentHead)
      Atomics.store(this.sab, currentHeadOffset + NODE.PREV_PTR, newPtr)
    }

    // 4. Update HEAD_PTR
    Atomics.store(this.sab, HDR.HEAD_PTR, newPtr)

    // 5. Signal structural change
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)
  }

  // ===========================================================================
  // Memory Management
  // ===========================================================================

  /**
   * Allocate a node from the free list.
   *
   * RFC-055 SPSC Invariant: Only the Worker thread (AudioWorklet) may call this.
   * In debug mode, warns if called outside audio context.
   *
   * @returns Node pointer, or NULL_PTR if heap exhausted or free list corrupted
   */
  allocNode(): NodePtr {
    // RFC-055: Debug-mode SPSC invariant check (Task 077: SAB flag, not process.env)
    if ((Atomics.load(this.sab, HDR.DEBUG_FLAGS) & DEBUG.ENABLED) && !this.isAudioContext) {
      console.warn(
        'SPSC WARNING: allocNode() called outside Worker context. ' +
        'Use Ring Buffer commands (insertAsync) instead. See RFC-055.'
      )
    }
    const ptr = this.freeList.alloc()
    if (ptr === NULL_PTR) {
      // Only set HEAP_EXHAUSTED if no error is already set (e.g., FREE_LIST_CORRUPT)
      const currentError = Atomics.load(this.sab, HDR.ERROR_FLAG)
      if (currentError === ERROR.OK) {
        Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.HEAP_EXHAUSTED)
      }
    }
    return ptr
  }

  /**
   * Return a node to the free list.
   *
   * RFC-055 SPSC Invariant: Only the Worker thread (AudioWorklet) may call this.
   * In debug mode, warns if called outside audio context.
   *
   * @param ptr - Node to free
   */
  freeNode(ptr: NodePtr): void {
    // RFC-055: Debug-mode SPSC invariant check (Task 077: SAB flag, not process.env)
    if ((Atomics.load(this.sab, HDR.DEBUG_FLAGS) & DEBUG.ENABLED) && !this.isAudioContext) {
      console.warn(
        'SPSC WARNING: freeNode() called outside Worker context. ' +
        'Use Ring Buffer commands (deleteAsync) instead. See RFC-055.'
      )
    }
    this.freeList.free(ptr)
  }

  // ===========================================================================
  // Attribute Patching (Immediate)
  // ===========================================================================

  patchPitch(ptr: NodePtr, pitch: number): void {
    this.patcher.patchPitch(ptr, pitch)
  }

  patchVelocity(ptr: NodePtr, velocity: number): void {
    this.patcher.patchVelocity(ptr, velocity)
  }

  patchDuration(ptr: NodePtr, duration: number): void {
    this.patcher.patchDuration(ptr, duration)
  }

  patchBaseTick(ptr: NodePtr, baseTick: number): void {
    this.patcher.patchBaseTick(ptr, baseTick)
  }

  patchMuted(ptr: NodePtr, muted: boolean): void {
    this.patcher.patchMuted(ptr, muted)
  }

  /**
   * Patch the sourceId field of a node.
   * M-003: Exposed for testing and advanced use cases.
   *
   * @param ptr - Node pointer
   * @param sourceId - New source ID
   * @returns true if patched, false if invalid pointer
   */
  patchSourceId(ptr: NodePtr, sourceId: number): boolean {
    return this.patcher.patchSourceId(ptr, sourceId)
  }

  /**
   * Patch multiple whole i32 fields in a single SEQ bump (Task 074).
   *
   * @param ptr - Node pointer
   * @param o1 - First field offset (NODE.* constant)
   * @param v1 - First field value
   * @param o2 - Second field offset
   * @param v2 - Second field value
   * @param o3 - Third field offset
   * @param v3 - Third field value
   * @param o4 - Fourth field offset
   * @param v4 - Fourth field value
   * @param count - Number of active offset/value pairs (1-4)
   * @returns true if patched, false if invalid pointer
   */
  patchMultiple(
    ptr: NodePtr,
    o1: number, v1: number,
    o2: number, v2: number,
    o3: number, v3: number,
    o4: number, v4: number,
    count: number
  ): boolean {
    return this.patcher.patchMultiple(ptr, o1, v1, o2, v2, o3, v3, o4, v4, count)
  }

  // ===========================================================================
  // Structural Operations
  // ===========================================================================

  /**
   * Convert byte pointer to i32 index.
   */
  private nodeOffset(ptr: NodePtr): number {
    return ptr / 4
  }

  /**
   * [RFC-054] Validate that a pointer is within the valid heap range.
   * Used by executeConnect/executeDisconnect for pointer safety.
   *
   * @param ptr - Byte offset pointer to validate
   * @returns true if pointer is within valid heap bounds, false otherwise
   */
  private isValidHeapPtr(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return false
    const ptrOffset = ptr / 4
    return ptrOffset >= this.heapStartI32 && ptr < this.buffer.byteLength
  }

  /**
   * Check if a pointer is within safe zone of playhead.
   * RFC-045-04: Returns false if violation, true if safe (no throw).
   */
  private checkSafeZone(targetTick: number): boolean {
    const playhead = Atomics.load(this.sab, HDR.PLAYHEAD_TICK)
    // M-002: Use Atomics.load for thread-safe header access
    const safeZone = Atomics.load(this.sab, HDR.SAFE_ZONE_TICKS)

    if (targetTick - playhead < safeZone && targetTick >= playhead) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.SAFE_ZONE)
      return false
    }
    return true
  }

  /**
   * Write node data to a node offset.
   */
  private writeNodeData(
    offset: number,
    opcode: number,
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    sourceId: number,
    flags: number
  ): void {
    // Pack opcode, pitch, velocity, flags into PACKED_A
    const activeFlags = flags | FLAG.ACTIVE
    const packed =
      (opcode << PACKED.OPCODE_SHIFT) |
      ((pitch & 0xff) << PACKED.PITCH_SHIFT) |
      ((velocity & 0xff) << PACKED.VELOCITY_SHIFT) |
      (activeFlags & PACKED.FLAGS_MASK)

    this.sab[offset + NODE.PACKED_A] = packed
    this.sab[offset + NODE.BASE_TICK] = baseTick | 0
    this.sab[offset + NODE.DURATION] = duration | 0
    // NEXT_PTR set separately during linking
    this.sab[offset + NODE.SOURCE_ID] = sourceId | 0
    // SEQ_FLAGS preserved from allocation (SEQ already set)
  }

  /**
   * Insert a new node after the given node.
   *
   * The Atomic Order of Operations (RFC-043 §7.4.2):
   * 1. Check safe zone
   * 2. Allocate NoteX from Free List
   * 3. Write all attributes to NoteX
   * 4. Link Future: NoteX.NEXT_PTR = NoteB, NoteX.PREV_PTR = NoteA
   * 5. Update NoteB.PREV_PTR = NoteX (if NoteB exists)
   * 6. Atomic Splice: NoteA.NEXT_PTR = NoteX
   * 7. Signal COMMIT_FLAG
   *
   * RFC-045-04: Returns NULL_PTR on error (check ERROR_FLAG for details).
   *
   * @param afterPtr - Node to insert after
   * @param opcode - Node opcode
   * @param pitch - MIDI pitch
   * @param velocity - MIDI velocity
   * @param duration - Duration in ticks
   * @param baseTick - Base tick
   * @param sourceId - Source ID
   * @param flags - Initial flags
   * @returns Pointer to new node, or NULL_PTR on error
   */
  private _insertNode(
    afterPtr: NodePtr,
    opcode: number,
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    sourceId: number,
    flags: number
  ): NodePtr {
    // Allocate new node first (before acquiring mutex)
    const newPtr = this.allocNode()
    if (newPtr === NULL_PTR) {
      // ERROR_FLAG already set by allocNode
      return NULL_PTR
    }
    const newOffset = this.nodeOffset(newPtr)

    // Write all attributes (before acquiring mutex)
    this.writeNodeData(newOffset, opcode, pitch, velocity, duration, baseTick, sourceId, flags)

    // **v1.5 CHAIN MUTEX**: Protect structural mutation
    if (!this._acquireChainMutex()) {
      // Deadlock detected - free the node and return error
      this.freeNode(newPtr)
      return NULL_PTR
    }

    // 1. Check safe zone INSIDE mutex (playhead may have moved during wait)
    const afterOffset = this.nodeOffset(afterPtr)
    const targetTick = this.sab[afterOffset + NODE.BASE_TICK]
    if (!this.checkSafeZone(targetTick)) {
      // Safe zone violation - free node and release mutex
      this.freeNode(newPtr)
      this._releaseChainMutex()
      return NULL_PTR
    }

    // 2. Link Future: NoteX.NEXT_PTR = NoteB, NoteX.PREV_PTR = NoteA
    const noteBPtr = Atomics.load(this.sab, afterOffset + NODE.NEXT_PTR)
    Atomics.store(this.sab, newOffset + NODE.NEXT_PTR, noteBPtr)
    Atomics.store(this.sab, newOffset + NODE.PREV_PTR, afterPtr)

    // 3. Update NoteB.PREV_PTR = NoteX (if NoteB exists)
    if (noteBPtr !== NULL_PTR) {
      const noteBOffset = this.nodeOffset(noteBPtr)
      Atomics.store(this.sab, noteBOffset + NODE.PREV_PTR, newPtr)
    }

    // 4. Atomic Splice: NoteA.NEXT_PTR = NoteX
    Atomics.store(this.sab, afterOffset + NODE.NEXT_PTR, newPtr)

    // 5. Increment NODE_COUNT (node is now linked)
    Atomics.add(this.sab, HDR.NODE_COUNT, 1)

    // 6. Signal structural change
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)

    // Release mutex and return success
    this._releaseChainMutex()
    return newPtr
  }

  /**
   * Insert a new node at the head of the chain.
   *
   * Uses Chain Mutex (v1.5) to protect structural mutations from concurrent workers.
   *
   * RFC-045-04: Returns NULL_PTR on error (check ERROR_FLAG for details).
   *
   * @param opcode - Node opcode
   * @param pitch - MIDI pitch
   * @param velocity - MIDI velocity
   * @param duration - Duration in ticks
   * @param baseTick - Base tick
   * @param sourceId - Source ID
   * @param flags - Initial flags
   * @returns Pointer to new node, or NULL_PTR on error
   */
  private _insertHead(
    opcode: number,
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    sourceId: number,
    flags: number
  ): NodePtr {
    // Allocate new node first (before acquiring mutex)
    const newPtr = this.allocNode()
    if (newPtr === NULL_PTR) {
      // ERROR_FLAG already set by allocNode
      return NULL_PTR
    }
    const newOffset = this.nodeOffset(newPtr)

    // Write attributes (before acquiring mutex)
    this.writeNodeData(newOffset, opcode, pitch, velocity, duration, baseTick, sourceId, flags)

    // **v1.5 CHAIN MUTEX**: Protect structural mutation
    if (!this._acquireChainMutex()) {
      // Deadlock detected - free the node and return error
      this.freeNode(newPtr)
      return NULL_PTR
    }

    // Check safe zone INSIDE mutex (playhead may have moved during wait)
    if (!this.checkSafeZone(baseTick)) {
      // Safe zone violation - free node and release mutex
      this.freeNode(newPtr)
      this._releaseChainMutex()
      return NULL_PTR
    }

    // Load current head (mutex guarantees exclusive access - no CAS needed)
    const currentHead = Atomics.load(this.sab, HDR.HEAD_PTR)

    // Link new node to current head
    Atomics.store(this.sab, newOffset + NODE.NEXT_PTR, currentHead)
    Atomics.store(this.sab, newOffset + NODE.PREV_PTR, NULL_PTR) // New head has no prev

    // Update old head's PREV_PTR to point to new head
    if (currentHead !== NULL_PTR) {
      const currentHeadOffset = this.nodeOffset(currentHead)
      Atomics.store(this.sab, currentHeadOffset + NODE.PREV_PTR, newPtr)
    }

    // Update HEAD_PTR (simple store - mutex guarantees no concurrent modification)
    Atomics.store(this.sab, HDR.HEAD_PTR, newPtr)

    // Increment NODE_COUNT (node is now linked)
    Atomics.add(this.sab, HDR.NODE_COUNT, 1)

    // Signal structural change
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)

    // Track operation for telemetry
    this._incrementTelemetry()

    // Release mutex and return success
    this._releaseChainMutex()
    return newPtr
  }

  /**
   * Delete a node from the chain.
   *
   * Uses Chain Mutex (v1.5) to protect structural mutations from concurrent workers.
   * O(1) deletion using PREV_PTR (doubly-linked list).
   *
   * RFC-045-04: Returns boolean instead of throwing (check ERROR_FLAG for details).
   *
   * @param ptr - Node to delete
   * @returns true if deleted, false on error
   */
  private _deleteNode(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return true // No-op is success

    const offset = this.nodeOffset(ptr)

    // **v1.5 CHAIN MUTEX**: Protect structural mutation
    if (!this._acquireChainMutex()) {
      // Deadlock detected - ERROR_FLAG already set
      return false
    }

    // Check safe zone INSIDE mutex (playhead may have moved during wait)
    // M-002: Use Atomics.load for thread-safe node field access
    const targetTick = Atomics.load(this.sab, offset + NODE.BASE_TICK)
    if (!this.checkSafeZone(targetTick)) {
      // Safe zone violation - release mutex and return error
      this._releaseChainMutex()
      return false
    }

    // Read prev and next pointers
    const prevPtr = Atomics.load(this.sab, offset + NODE.PREV_PTR)
    const nextPtr = Atomics.load(this.sab, offset + NODE.NEXT_PTR)

    // Update prev's NEXT_PTR (or HEAD_PTR if deleting head)
    if (prevPtr === NULL_PTR) {
      // Deleting head - update HEAD_PTR (mutex guarantees exclusive access - no CAS needed)
      // Verify we're still deleting the head (sanity check)
      const currentHead = Atomics.load(this.sab, HDR.HEAD_PTR)
      if (currentHead !== ptr) {
        // Head changed - this shouldn't happen with mutex, set error and abort
        Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
        this._releaseChainMutex()
        return false
      }
      // Update HEAD_PTR to next node (simple store - mutex guarantees no concurrent modification)
      Atomics.store(this.sab, HDR.HEAD_PTR, nextPtr)
    } else {
      // Update previous node's NEXT_PTR to skip over deleted node
      const prevOffset = this.nodeOffset(prevPtr)
      Atomics.store(this.sab, prevOffset + NODE.NEXT_PTR, nextPtr)
    }

    // Update next's PREV_PTR (if next exists)
    if (nextPtr !== NULL_PTR) {
      const nextOffset = this.nodeOffset(nextPtr)
      Atomics.store(this.sab, nextOffset + NODE.PREV_PTR, prevPtr)
    }

    // Decrement NODE_COUNT (RFC-045: now done at unlink time, not at free time)
    Atomics.sub(this.sab, HDR.NODE_COUNT, 1)

    // Free the node (K-005: Zone B Reclamation Logic)
    // FIRST: Clear ACTIVE flag so getSourceId returns undefined after delete
    const packedA = Atomics.load(this.sab, offset + NODE.PACKED_A)
    Atomics.store(this.sab, offset + NODE.PACKED_A, packedA & ~FLAG.ACTIVE)

    if (ptr >= this.zoneBStartPtr) {
      // Zone B (Main Thread Owned) -> Push to Reclaim Ring
      const tail = Atomics.load(this.sab, HDR.RECLAIM_RB_TAIL)
      const capacity = Atomics.load(this.sab, HDR.RECLAIM_RB_CAPACITY)

      // Calculate write position (power-of-2 mask)
      const mask = capacity - 1
      const idx = tail & mask

      // Calculate buffer offset
      const ringDataOffset = Atomics.load(this.sab, HDR.RECLAIM_RING_PTR)
      const ringDataI32 = ringDataOffset / 4

      // Write pointer atomically (release semantics on ARM)
      Atomics.store(this.sab, ringDataI32 + idx, ptr)

      // Commit write (consumer will see data due to acquire-release)
      Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
    } else {
      // Zone A (Worker Owned) -> Free List
      this.freeList.free(ptr)
    }

    // Signal structural change
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)

    // Track operation for telemetry
    this._incrementTelemetry()

    // Release mutex and return success
    this._releaseChainMutex()
    return true
  }

  // ===========================================================================
  // Commit Protocol
  // ===========================================================================


  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get head of chain.
   */
  getHead(): NodePtr {
    return Atomics.load(this.sab, HDR.HEAD_PTR)
  }

  /**
   * Read raw node fields into a caller-owned Int32Array(8).
   *
   * SeqLock read: retries until seq_before === seq_after (via seqChanged).
   * On success (true), buf[0..7] is a consistent snapshot of all 8 node i32 fields.
   * On failure (false), buf[NODE.NEXT_PTR] is still individually atomic and usable
   * for chain continuation; other fields may be torn.
   *
   * @param ptr - Node byte pointer
   * @param buf - Caller-owned Int32Array of length >= 8
   * @returns true if consistent snapshot obtained, false if NULL_PTR or contention
   */
  readNodeRaw(ptr: NodePtr, buf: Int32Array): boolean {
    if (ptr === NULL_PTR) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      return false
    }

    const offset = this.nodeOffset(ptr)
    const MAX_SPINS = 50
    let retries = 0

    while (retries < MAX_SPINS) {
      const seq1 = (Atomics.load(this.sab, offset + NODE.SEQ_FLAGS) & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT

      buf[0] = Atomics.load(this.sab, offset + NODE.PACKED_A)
      buf[1] = Atomics.load(this.sab, offset + NODE.BASE_TICK)
      buf[2] = Atomics.load(this.sab, offset + NODE.DURATION)
      buf[3] = Atomics.load(this.sab, offset + NODE.NEXT_PTR)
      buf[4] = Atomics.load(this.sab, offset + NODE.PREV_PTR)
      buf[5] = Atomics.load(this.sab, offset + NODE.SOURCE_ID)
      buf[6] = Atomics.load(this.sab, offset + NODE.SEQ_FLAGS)
      buf[7] = Atomics.load(this.sab, offset + NODE.LAST_PASS_ID)

      const seq2 = (buf[6] & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT

      if (!seqChanged(seq1, seq2)) {
        return true
      }

      retries = retries + 1
    }

    return false
  }

  // ===========================================================================
  // Register Operations
  // ===========================================================================

  /**
   * Set active groove template.
   */
  setGroove(ptr: NodePtr, length: number): void {
    Atomics.store(this.sab, REG.GROOVE_PTR, ptr)
    Atomics.store(this.sab, REG.GROOVE_LEN, length)
  }

  /**
   * Disable groove.
   */
  clearGroove(): void {
    Atomics.store(this.sab, REG.GROOVE_PTR, NULL_PTR)
    Atomics.store(this.sab, REG.GROOVE_LEN, 0)
  }

  /**
   * Set humanization parameters.
   */
  setHumanize(timingPpt: number, velocityPpt: number): void {
    Atomics.store(this.sab, REG.HUMAN_TIMING_PPT, timingPpt | 0)
    Atomics.store(this.sab, REG.HUMAN_VEL_PPT, velocityPpt | 0)
  }

  /**
   * Set global transposition.
   */
  setTranspose(semitones: number): void {
    Atomics.store(this.sab, REG.TRANSPOSE, semitones | 0)
  }

  /**
   * Set global velocity multiplier.
   */
  setVelocityMult(ppt: number): void {
    Atomics.store(this.sab, REG.VELOCITY_MULT, ppt | 0)
  }

  /**
   * Set PRNG seed for humanization.
   */
  setPrngSeed(seed: number): void {
    Atomics.store(this.sab, REG.PRNG_SEED, seed | 0)
  }

  /**
   * Set BPM (can be updated live).
   *
   * BPM affects timing calculations for the audio thread.
   * Changes take effect immediately via atomic store.
   *
   * @param bpm - Beats per minute (positive integer)
   */
  setBpm(bpm: number): void {
    Atomics.store(this.sab, HDR.BPM, bpm | 0)
  }

  /**
   * Get current BPM (beats per minute).
   *
   * @returns Current BPM value (default: 120)
   *
   * @remarks
   * Thread-safe read via `Atomics.load`.
   */
  getBpm(): number {
    return Atomics.load(this.sab, HDR.BPM)
  }

  /**
   * Update the playhead position (for UI visualization).
   *
   * @param tick - Current playback tick
   */
  setPlayheadTick(tick: number): void {
    Atomics.store(this.sab, HDR.PLAYHEAD_TICK, tick | 0)
  }

  /**
   * Get PPQ (Pulses Per Quarter note / ticks per beat).
   *
   * PPQ determines the resolution of timing in the system.
   * Higher values allow finer timing precision.
   *
   * @returns PPQ value (default: 480)
   *
   * @remarks
   * PPQ is set at SAB creation and is immutable.
   * M-002: Use Atomics.load for memory ordering guarantees (especially ARM).
   */
  getPpq(): number {
    return Atomics.load(this.sab, HDR.PPQ)
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  /**
   * Get current error flag value from the SAB.
   *
   * Error codes are defined in `constants.ts` under the `ERROR` constant.
   * Common values:
   * - `ERROR.OK` (0): No error
   * - `ERROR.HEAP_EXHAUSTED` (1): Free list depleted
   * - `ERROR.SAFE_ZONE` (2): Edit within safe zone rejected
   * - `ERROR.INVALID_PTR` (3): Invalid pointer operation
   * - `ERROR.KERNEL_PANIC` (4): Deadlock or severe contention
   * - `ERROR.LOAD_FACTOR_WARNING` (5): Identity Table >75% full
   * - `ERROR.FREE_LIST_CORRUPT` (6): Free list corruption detected
   * - `ERROR.UNKNOWN_OPCODE` (7): Unknown command opcode
   *
   * @returns The current error code (0 = no error)
   *
   * @remarks
   * Error flags are set atomically by operations that encounter errors.
   * Check this value after operations that can fail to determine the cause.
   * Call `clearError()` after handling to reset the flag.
   */
  getError(): number {
    return Atomics.load(this.sab, HDR.ERROR_FLAG)
  }

  /**
   * Clear the error flag (reset to ERROR.OK).
   *
   * Call this after handling an error condition to reset the flag.
   * Failure to clear can mask subsequent errors.
   *
   * @remarks
   * Uses `Atomics.store` for thread-safe clearing.
   */
  clearError(): void {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.OK)
  }

  /**
   * Get the number of nodes currently linked in the chain.
   *
   * This count represents active nodes in the linked list, not total
   * allocations. Nodes are counted when linked (INSERT) and uncounted
   * when unlinked (DELETE).
   *
   * @returns Number of nodes in the chain (0 to nodeCapacity)
   *
   * @remarks
   * Thread-safe read via `Atomics.load`.
   */
  getNodeCount(): number {
    return Atomics.load(this.sab, HDR.NODE_COUNT)
  }

  /**
   * Get the number of nodes available in the Zone A free list.
   *
   * This represents nodes that can be allocated via `allocNode()`.
   * When this reaches 0, `allocNode()` returns NULL_PTR.
   *
   * @returns Number of free nodes available
   *
   * @remarks
   * Thread-safe read via `Atomics.load`.
   * Note: Zone B (local allocator) has a separate free pool.
   */
  getFreeCount(): number {
    return Atomics.load(this.sab, HDR.FREE_COUNT)
  }

  /**
   * Get the total node capacity configured for this linker.
   *
   * This is the maximum number of nodes that can exist simultaneously.
   * Configured at SAB creation time via `LinkerConfig.nodeCapacity`.
   *
   * @returns Maximum node capacity (default: 4096)
   */
  getNodeCapacity(): number {
    return this.nodeCapacity
  }

  /**
   * Get the underlying SharedArrayBuffer for direct access.
   *
   * @returns The SharedArrayBuffer backing this linker
   *
   * @remarks
   * Use this for:
   * - Passing the SAB to an AudioWorklet
   * - Creating additional views (Float32Array, BigInt64Array)
   * - Debug inspection of raw memory
   *
   * **Warning:** Direct manipulation can corrupt linker state.
   * Prefer using linker methods for all operations.
   */
  getSAB(): SharedArrayBuffer {
    return this.buffer
  }

  /**
   * Reset the entire Linker state (RFC-044 Resilience).
   *
   * **DANGER:** This nukes all memory state:
   * - Clears all nodes and resets chain to empty
   * - Reinitializes Zone A free list (Zone B left untouched)
   * - Clears Identity and Symbol tables
   * - Resets Ring Buffer headers
   * - Clears error flags
   * - Wakes blocked Worker threads via Atomics.notify
   *
   * **Thread Safety:**
   * NOT thread-safe. Only call when no other threads are accessing the SAB.
   * Typically used during app initialization or after detecting a stale SAB.
   *
   * **Use Cases:**
   * - Page reload detected (SAB persists but app state is fresh)
   * - Zone B exhaustion recovery
   * - Error recovery after KERNEL_PANIC
   *
   * After calling reset(), the SiliconBridge must also call
   * `localAllocator.reset()` to reset Zone B bump pointer.
   */
  reset(): void {
    resetLinkerSAB(this.buffer)

    // Wake any Worker threads blocked on Atomics.wait(YIELD_SLOT)
    // This ensures Workers immediately see the reset state (HEAD_PTR = NULL, etc.)
    Atomics.notify(this.sab, HDR.YIELD_SLOT, 1)
  }

  /**
   * Get current playhead tick position (set by AudioWorklet).
   *
   * The playhead represents the current position in the audio timeline.
   * It is updated atomically by the AudioWorklet during playback.
   *
   * @returns Current playhead position in ticks
   *
   * @remarks
   * Thread-safe read via `Atomics.load`.
   * Used for safe zone calculations to prevent edits near playhead.
   */
  getPlayheadTick(): number {
    return Atomics.load(this.sab, HDR.PLAYHEAD_TICK)
  }

  /**
   * Get safe zone size in ticks.
   *
   * The safe zone is a protected region around the playhead where
   * structural edits (INSERT/DELETE) are rejected to prevent audio
   * glitches. Edits within `playhead + safeZoneTicks` are blocked.
   *
   * @returns Safe zone size in ticks (default: 960 = 2 beats at 480 PPQ)
   *
   * @remarks
   * Safe zone is set at SAB creation and is immutable.
   * M-002: Use Atomics.load for memory ordering guarantees (especially ARM).
   */
  getSafeZoneTicks(): number {
    return Atomics.load(this.sab, HDR.SAFE_ZONE_TICKS)
  }

  // ===========================================================================
  // Identity Table Operations (v1.5)
  // ===========================================================================

  /**
   * Compute hash slot for a sourceId using Knuth's multiplicative hash.
   *
   * **Bitwise Optimization**: Uses `& (capacity - 1)` instead of `% capacity`
   * since DEFAULT_CAPACITY is 4096 (power of 2). This eliminates expensive
   * modulo division on the hot path.
   *
   * @param sourceId - The source ID to hash
   * @returns Slot index in the Identity Table
   */
  private idTableHash(sourceId: number): number {
    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    // Knuth's multiplicative hash with bitwise modulo (capacity must be power of 2)
    const hash = Math.imul(sourceId >>> 0, KNUTH_HASH_CONST) >>> 0
    return hash & (capacity - 1)
  }

  /**
   * Get the i32 offset for a slot in the Identity Table.
   * Each slot is 2 × i32: [TID, NodePtr]
   */
  private idTableSlotOffset(slot: number): number {
    const tablePtr = Atomics.load(this.sab, HDR.ID_TABLE_PTR)
    return (tablePtr / 4) + slot * ID_TABLE.ENTRY_SIZE_I32
  }

  /**
 * Insert a sourceId → NodePtr mapping into the Identity Table.
 * Uses triangular number probing for collision resolution (Task 078).
 * Probing sequence: slot += step; step++ — guarantees full coverage for power-of-2 capacity.
 *
 * @param sourceId - Source ID (must be > 0)
 * @param ptr - Node pointer
 * @returns true if inserted, false if table full
 */
  idTableInsert(sourceId: number, ptr: NodePtr): boolean {
    if (sourceId <= 0) return false

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    // Triangular number probing: slot += step; step++ (full coverage for power-of-2)
    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const offset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, offset)

      if (tid === ID_TABLE.EMPTY_TID || tid === ID_TABLE.TOMBSTONE_TID) {
        Atomics.store(this.sab, offset, sourceId)
        Atomics.store(this.sab, offset + 1, ptr)
        const newUsed = Atomics.add(this.sab, HDR.ID_TABLE_USED, 1) + 1

        if (newUsed / capacity > ID_TABLE.LOAD_FACTOR_WARNING) {
          Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.LOAD_FACTOR_WARNING)
        }

        return true
      }

      if (tid === sourceId) {
        Atomics.store(this.sab, offset + 1, ptr)
        return true
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return false
  }

  /**
   * Lookup a NodePtr by sourceId in the Identity Table.
   * Uses triangular number probing for collision resolution (Task 078).
   *
   * @param sourceId - Source ID to lookup
   * @returns NodePtr if found, NULL_PTR if not found
   */
  idTableLookup(sourceId: number): NodePtr {
    if (sourceId <= 0) return NULL_PTR

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const offset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, offset)

      if (tid === ID_TABLE.EMPTY_TID) {
        return NULL_PTR
      }

      if (tid === sourceId) {
        return Atomics.load(this.sab, offset + 1)
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return NULL_PTR
  }

  /**
   * Remove a sourceId from the Identity Table.
   * Marks the slot as a tombstone (TID = -1).
   * Uses triangular number probing for collision resolution (Task 078).
   *
   * NOTE: Tombstones accumulate over time and degrade lookup performance.
   * Call idTableRepack() during bridge.clear() to eliminate tombstones.
   *
   * @param sourceId - Source ID to remove
   * @returns true if removed, false if not found
   */
  idTableRemove(sourceId: number): boolean {
    if (sourceId <= 0) return false

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const offset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, offset)

      if (tid === ID_TABLE.EMPTY_TID) {
        return false
      }

      if (tid === sourceId) {
        Atomics.store(this.sab, offset, ID_TABLE.TOMBSTONE_TID)
        Atomics.store(this.sab, offset + 1, NULL_PTR)
        return true
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return false
  }

  /**
   * Clear the entire Identity Table (memset-style).
   * Sets all slots to EMPTY_TID (0).
   *
   * **Atomic Strictness**: All writes use Atomics for thread safety.
   * This also eliminates all tombstones (effective re-pack).
   */
  idTableClear(): void {
    const tablePtr = Atomics.load(this.sab, HDR.ID_TABLE_PTR)
    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const tableOffsetI32 = tablePtr / 4
    const totalI32 = capacity * ID_TABLE.ENTRY_SIZE_I32

    // Zero out entire table using Atomics
    let i = 0
    while (i < totalI32) {
      Atomics.store(this.sab, tableOffsetI32 + i, 0)
      i = i + 1
    }

    // Reset used count and clear load factor warning
    Atomics.store(this.sab, HDR.ID_TABLE_USED, 0)
    // Clear ERROR_FLAG only if it was LOAD_FACTOR_WARNING
    const currentError = Atomics.load(this.sab, HDR.ERROR_FLAG)
    if (currentError === ERROR.LOAD_FACTOR_WARNING) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.OK)
    }
  }

  /**
   * Rebuild the Identity Table from the live chain.
   * Task 3.5: Addresses spec debt — no way to rebuild ID table after clearing.
   *
   * **Use Case:** After idTableClear() or when tombstones exceed threshold.
   *
   * **Thread Safety:** Acquires Chain Mutex for duration.
   *
   * @returns Number of entries rebuilt, or -1 if mutex acquisition failed
   */
  idTableRebuild(): number {
    if (!this._acquireChainMutex()) {
      return -1
    }

    // 1. Clear table (removes all tombstones)
    this.idTableClear()

    // 2. Traverse chain and re-insert all sourceIds
    let count = 0
    let ptr = Atomics.load(this.sab, HDR.HEAD_PTR)

    while (ptr !== NULL_PTR) {
      const offset = this.nodeOffset(ptr)
      const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)

      if (sourceId > 0) {
        this.idTableInsert(sourceId, ptr)
        count = count + 1
      }

      ptr = Atomics.load(this.sab, offset + NODE.NEXT_PTR)
    }

    this._releaseChainMutex()
    return count
  }

  // ===========================================================================
  // Symbol Table Operations (v1.5) - SourceId → Packed SourceLocation
  // ===========================================================================

  /**
   * Get the i32 offset for a slot in the Symbol Table.
   * Each slot is 2 × i32: [fileHash, lineCol]
   */
  private symTableSlotOffset(slot: number): number {
    // Read capacity atomically to prevent desync in multi-worker environments
    const nodeCapacity = Atomics.load(this.sab, HDR.NODE_CAPACITY)
    const tableOffset = getSymbolTableOffset(nodeCapacity)
    return (tableOffset / 4) + slot * SYM_TABLE.ENTRY_SIZE_I32
  }

  /**
   * Store a packed SourceLocation in the Symbol Table for a sourceId.
   * Uses triangular number probing (Task 078) matching the Identity Table.
   *
   * **Race-Free Write Order**: This method can be called BEFORE idTableInsert.
   * It finds the slot independently using the same hash/probe logic.
   *
   * @param sourceId - Source ID
   * @param fileHash - Hash of the file path
   * @param line - Line number (0-65535)
   * @param column - Column number (0-65535)
   * @returns true if stored, false if table full
   */
  symTableStore(sourceId: number, fileHash: number, line: number, column: number): boolean {
    if (sourceId <= 0) return false

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    // Triangular number probing — must match Identity Table probing
    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const idOffset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, idOffset)

      if (tid === ID_TABLE.EMPTY_TID || tid === ID_TABLE.TOMBSTONE_TID || tid === sourceId) {
        const symOffset = this.symTableSlotOffset(slot)
        const lineCol = ((line & SYM_TABLE.MAX_LINE) << SYM_TABLE.LINE_SHIFT) |
          (column & SYM_TABLE.COLUMN_MASK)
        Atomics.store(this.sab, symOffset, fileHash | 0)
        Atomics.store(this.sab, symOffset + 1, lineCol)
        return true
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return false
  }

  /**
   * Lookup a packed SourceLocation by sourceId with zero-allocation callback.
   * Uses triangular number probing to match Identity Table (Task 078).
   *
   * @param sourceId - Source ID to lookup
   * @param cb - Callback receiving (fileHash, line, column) if found
   * @returns true if found and callback invoked, false if not found
   */
  symTableLookup(
    sourceId: number,
    cb: (fileHash: number, line: number, column: number) => void
  ): boolean {
    if (sourceId <= 0) return false

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const idOffset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, idOffset)

      if (tid === ID_TABLE.EMPTY_TID) {
        return false
      }

      if (tid === sourceId) {
        const symOffset = this.symTableSlotOffset(slot)
        const fileHash = Atomics.load(this.sab, symOffset)
        const lineCol = Atomics.load(this.sab, symOffset + 1)

        if (fileHash === SYM_TABLE.EMPTY_ENTRY) {
          return false
        }

        const line = (lineCol >>> SYM_TABLE.LINE_SHIFT) & SYM_TABLE.MAX_LINE
        const column = lineCol & SYM_TABLE.COLUMN_MASK
        cb(fileHash, line, column)
        return true
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return false
  }

  /**
   * Remove a SourceLocation from the Symbol Table.
   * Clears the entry at the slot corresponding to sourceId.
   * Uses triangular number probing to match Identity Table (Task 078).
   *
   * @param sourceId - Source ID whose location should be removed
   * @returns true if removed, false if not found
   */
  symTableRemove(sourceId: number): boolean {
    if (sourceId <= 0) return false

    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const mask = capacity - 1

    let slot = this.idTableHash(sourceId) & mask
    let step = 1
    let probes = 0
    while (probes < capacity) {
      const idOffset = this.idTableSlotOffset(slot)
      const tid = Atomics.load(this.sab, idOffset)

      if (tid === ID_TABLE.EMPTY_TID) {
        return false
      }

      if (tid === sourceId) {
        const symOffset = this.symTableSlotOffset(slot)
        Atomics.store(this.sab, symOffset, SYM_TABLE.EMPTY_ENTRY)
        Atomics.store(this.sab, symOffset + 1, 0)
        return true
      }

      slot = (slot + step) & mask
      step = step + 1
      probes = probes + 1
    }

    return false
  }

  /**
   * Clear the entire Symbol Table (memset-style).
   * Sets all entries to EMPTY_ENTRY (0).
   */
  symTableClear(): void {
    // Read node capacity atomically to prevent desync in multi-worker environments
    const nodeCapacity = Atomics.load(this.sab, HDR.NODE_CAPACITY)
    const tableOffset = getSymbolTableOffset(nodeCapacity)
    const capacity = Atomics.load(this.sab, HDR.ID_TABLE_CAPACITY)
    const tableOffsetI32 = tableOffset / 4
    const totalI32 = capacity * SYM_TABLE.ENTRY_SIZE_I32

    // Zero out entire table using Atomics
    let i = 0
    while (i < totalI32) {
      Atomics.store(this.sab, tableOffsetI32 + i, 0)
      i = i + 1
    }
  }

  // ===========================================================================
  // RFC-045: Synapse Table Operations
  // ===========================================================================

  /**
   * Clear the entire Synapse Table (memset-style).
   * Sets all SOURCE_PTR fields to NULL_PTR, effectively tombstoning all synapses.
   *
   * **Performance:** O(n) where n = synapseCapacity (dynamic).
   * ~1ms on modern hardware.
   *
   * **Thread Safety:** Must be called with Chain Mutex held.
   */
  private synapseTableClear(): void {
    const nodeCapacity = Atomics.load(this.sab, HDR.NODE_CAPACITY)
    const synapseCapacity = Atomics.load(this.sab, HDR.SYNAPSE_CAPACITY) // K-002: dynamic
    const tableOffsetI32 = getSynapseTableOffset(nodeCapacity) / 4

    let slot = 0
    while (slot < synapseCapacity) {
      const offset = tableOffsetI32 + slot * SYNAPSE_TABLE.STRIDE_I32
      // Zero all 5 words of each synapse entry
      Atomics.store(this.sab, offset + SYNAPSE.SOURCE_PTR, NULL_PTR)
      Atomics.store(this.sab, offset + SYNAPSE.TARGET_PTR, NULL_PTR)
      Atomics.store(this.sab, offset + SYNAPSE.WEIGHT_DATA, 0)
      Atomics.store(this.sab, offset + SYNAPSE.META_NEXT, 0)
      slot = slot + 1
    }
  }

  /**
   * Compact the Synapse Table with mutex protection.
   * 
   * **Thread Safety:** Acquires Chain Mutex for duration of compaction.
   * This is a stop-the-world operation that rehashes all live synapses
   * and removes tombstones.
   * 
   * **Use Cases:**
   * - Call after many disconnect() operations to reclaim tombstone slots
   * - Call during maintenance windows to optimize lookup performance
   * 
   * @returns Number of live synapses after compaction, or -1 if mutex failed
   */
  compactSynapseTable(): number {
    if (this.synapseAllocator === null) return -1
    return this.synapseAllocator.compactTableSafe(
      () => this._acquireChainMutex(),
      () => this._releaseChainMutex()
    )
  }

  /**
   * Conditionally compact Synapse Table if tombstone ratio exceeds threshold.
   * 
   * **Thread Safety:** Acquires Chain Mutex only if compaction is needed.
   * 
   * **Threshold:** Compaction triggers when tombstones exceed 50% of used slots
   * AND at least 100 slots have been used.
   * 
   * @returns Number of live synapses after compaction, 0 if not needed, or -1 if mutex failed
   */
  maybeCompactSynapseTable(): number {
    if (this.synapseAllocator === null) return 0
    return this.synapseAllocator.maybeCompactSafe(
      () => this._acquireChainMutex(),
      () => this._releaseChainMutex()
    )
  }

  // ===========================================================================
  // RFC-044: Command Ring Processing (Worker/Consumer Side)
  // ===========================================================================

  /**
   * Process pending commands from the Ring Buffer (RFC-044).
   *
   * This is the "Read Path" of the RFC-044 protocol. The Worker dequeues
   * commands written by the Main Thread and executes them asynchronously.
   *
   * **Hybrid Trigger:**
   * - Passive: Called by AudioWorklet at start of process() (polling)
   * - Active: Worker wakes via Atomics.wait() on YIELD_SLOT
   *
   * **Performance:**
   * - Processes max 256 commands per call to prevent audio starvation
   * - Each command: ~1-2µs (linking only, allocation already done)
   *
   * @returns Number of commands processed
   */
  processCommands(): number {
    const MAX_COMMANDS_PER_CYCLE = 256
    let commandsProcessed = 0

    // Process commands until ring is empty or limit reached
    while (commandsProcessed < MAX_COMMANDS_PER_CYCLE) {
      // Read next command (zero-alloc: reuses this.commandBuffer)
      const hasCommand = this.ringBuffer.read(this.commandBuffer)
      if (!hasCommand) {
        break // Ring buffer is empty
      }

      // Decode command
      const opcode = this.commandBuffer[0]
      const param1 = this.commandBuffer[1]
      const param2 = this.commandBuffer[2]
      const param3 = this.commandBuffer[3] // [RFC-054] PackedWJ for CONNECT

      // Execute command based on opcode
      switch (opcode) {
        case CMD.INSERT:
          this.executeInsert(param1, param2)
          break
        case CMD.DELETE:
          this.executeDelete(param1)
          break
        case CMD.CLEAR:
          this.executeClear()
          break
        case CMD.PATCH:
          // PATCH not implemented in MVP (direct patches are immediate)
          // Could be used for batched/deferred patches in future
          break
        case CMD.CONNECT:
          // [RFC-054] Create synapse using raw pointers
          this.executeConnect(param1, param2, param3)
          break
        case CMD.DISCONNECT:
          // [RFC-054] Remove synapse using raw pointers
          this.executeDisconnect(param1, param2)
          break
        default:
          // Unknown opcode - set error flag (zero-allocation)
          Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.UNKNOWN_OPCODE)
      }

      commandsProcessed = commandsProcessed + 1
    }

    return commandsProcessed
  }

  /**
   * Execute INSERT command: Link a floating node into the chain (RFC-044).
   *
   * **Protocol:**
   * - ptr: Byte offset to node (already allocated in Zone B and written)
   * - prevPtr: Byte offset to insert after (NULL_PTR = head insert)
   *
   * **Steps:**
   * 1. Acquire Chain Mutex
   * 2. Validate pointers
   * 3. Link node using _linkNode or _linkHead
   * 4. Update Identity Table
   * 5. Release mutex
   *
   * RFC-045-04: Returns boolean instead of throwing.
   *
   * @param ptr - Pointer to node to link (Zone B)
   * @param prevPtr - Pointer to insert after (or NULL_PTR for head)
   * @returns true on success, false on error (ERROR_FLAG set)
   */
  private executeInsert(ptr: NodePtr, prevPtr: NodePtr): boolean {
    // Acquire mutex for structural operation
    if (!this._acquireChainMutex()) {
      return false // Deadlock - ERROR_FLAG already set
    }

    // Validate ptr is in valid range
    const ptrOffset = ptr / 4
    if (ptrOffset < this.heapStartI32 || ptr >= this.buffer.byteLength) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      this._releaseChainMutex()
      return false
    }

    // Read sourceId from the node (already written by Main Thread)
    const nodeOffset = this.nodeOffset(ptr)
    const sourceId = Atomics.load(this.sab, nodeOffset + NODE.SOURCE_ID)

    // Link the node into the chain
    if (prevPtr === NULL_PTR) {
      // Head insert
      this._linkHead(ptr)
    } else {
      // Insert after prevPtr
      // Validate prevPtr is in valid range
      const prevPtrOffset = prevPtr / 4
      if (prevPtrOffset < this.heapStartI32 || prevPtr >= this.buffer.byteLength) {
        Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
        this._releaseChainMutex()
        return false
      }
      this._linkNode(ptr, prevPtr)
    }

    // Increment NODE_COUNT (node is now linked)
    Atomics.add(this.sab, HDR.NODE_COUNT, 1)

    // Track operation for telemetry
    this._incrementTelemetry()

    this._releaseChainMutex()

    // RFC-047-50: Move Identity Table update OUTSIDE mutex
    // This is safe because the node is already linked; ID table is purely for lookup.
    // Moving this outside reduces critical section time and eliminates O(n²) contention.
    if (sourceId > 0) {
      const inserted = this.idTableInsert(sourceId, ptr)
      if (!inserted) {
        // Table full - set error flag (node is linked but unmapped - degraded state)
        Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.LOAD_FACTOR_WARNING)
      }
    }

    return true
  }

  /**
   * Execute DELETE command: Remove a node from the chain (RFC-044).
   *
   * **CRITICAL:** Extracts sourceId BEFORE unlinking to ensure Identity Table
   * and Symbol Table cleanup occurs after successful deletion.
   *
   * RFC-045-04: Returns boolean (no try/catch).
   * RFC-002 Remediation: Added idTableRemove/symTableRemove calls.
   *
   * @param ptr - Pointer to node to delete
   * @returns true on success, false on error
   */
  private executeDelete(ptr: NodePtr): boolean {
    // Extract sourceId BEFORE unlinking (node data may be overwritten after free)
    const offset = ptr / 4
    const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)

    // Delete from chain (handles mutex, unlinking, free list return)
    const success = this._deleteNode(ptr)

    // Clean up Identity Table and Symbol Table entries
    if (success && sourceId > 0) {
      this.idTableRemove(sourceId)
      this.symTableRemove(sourceId)
    }

    return success
  }

  /**
   * [RFC-054] Execute CONNECT command: Create synaptic connection using raw pointers.
   *
   * This enables async-safe synapse creation for newly allocated nodes that
   * are not yet in the Identity Table. Uses FIFO guarantee of Ring Buffer
   * to ensure source/target nodes exist before connection.
   *
   * @param srcPtr - Byte offset to source node (trigger point)
   * @param tgtPtr - Byte offset to target node (destination)
   * @param packedWJ - Packed weight and jitter: (weight << 16) | (jitter & 0xFFFF)
   * @returns true on success, false on error (ERROR_FLAG set)
   */
  private executeConnect(srcPtr: NodePtr, tgtPtr: NodePtr, packedWJ: number): boolean {
    if (this.synapseAllocator === null) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      return false
    }

    // 1. Validate pointers are in valid heap range
    if (!this.isValidHeapPtr(srcPtr) || !this.isValidHeapPtr(tgtPtr)) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      return false
    }

    // 2. Unpack weight and jitter
    const weight = (packedWJ >>> 16) || 500 // Default 500 if 0
    const jitter = packedWJ & 0xFFFF

    // 3. Create synapse (returns SynapsePtr or error code)
    const result = this.synapseAllocator.connect(srcPtr, tgtPtr, weight, jitter)
    return result >= 0
  }

  /**
   * [RFC-054] Execute DISCONNECT command: Remove synaptic connection using raw pointers.
   *
   * Supports both single-target and all-target disconnection:
   * - If tgtPtr === NULL_PTR: Disconnect ALL synapses from source
   * - If tgtPtr is valid: Disconnect only the specific synapse
   *
   * @param srcPtr - Byte offset to source node (trigger point)
   * @param tgtPtr - Byte offset to target node, or NULL_PTR for "disconnect all"
   * @returns true on success, false on error (ERROR_FLAG set)
   */
  private executeDisconnect(srcPtr: NodePtr, tgtPtr: NodePtr): boolean {
    if (this.synapseAllocator === null) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      return false
    }

    // Validate source pointer
    if (!this.isValidHeapPtr(srcPtr)) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
      return false
    }

    if (tgtPtr === NULL_PTR) {
      // Disconnect all synapses from source (targetPtr = undefined)
      this.synapseAllocator.disconnect(srcPtr)
      return true
    } else {
      // Disconnect specific synapse
      if (!this.isValidHeapPtr(tgtPtr)) {
        Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR)
        return false
      }
      this.synapseAllocator.disconnect(srcPtr, tgtPtr)
      return true
    }
  }

  /**
   * Execute CLEAR command: Remove all nodes from the chain (RFC-044).
   *
   * RFC-045-04: Returns boolean instead of using try/finally.
   *
   * **Implementation:** Uses while-head deletion loop (zero-alloc).
   *
   * @returns true on success, false on mutex error
   */
  private executeClear(): boolean {
    if (!this._acquireChainMutex()) {
      return false // Deadlock - ERROR_FLAG already set
    }

    // While-head deletion loop (zero-alloc)
    let headPtr = Atomics.load(this.sab, HDR.HEAD_PTR)
    while (headPtr !== NULL_PTR) {
      const headOffset = this.nodeOffset(headPtr)
      const nextPtr = Atomics.load(this.sab, headOffset + NODE.NEXT_PTR)

      // Return node to free list
      this.freeList.free(headPtr)

      // Move to next
      headPtr = nextPtr
    }

    // Update header
    Atomics.store(this.sab, HDR.HEAD_PTR, NULL_PTR)
    Atomics.store(this.sab, HDR.NODE_COUNT, 0)
    Atomics.store(this.sab, HDR.COMMIT_FLAG, COMMIT.PENDING)

    // Clear Identity, Symbol, and Synapse tables
    this.idTableClear()
    this.symTableClear()
    this.synapseTableClear()

    // Reset allocator tracking counters if injected
    if (this.synapseAllocator !== null) {
      this.synapseAllocator.clear()
    }

    // Track operation for telemetry
    this._incrementTelemetry()

    this._releaseChainMutex()
    return true
  }

  /**
   * Poll for pending commands (passive trigger for AudioWorklet).
   *
   * This is the primary entry point for consuming Ring Buffer commands
   * from the audio thread. It automatically enables audio-safe mutex
   * behavior (RFC-045-04 ISSUE-001) to prevent blocking.
   *
   * **Audio Thread Safety:**
   * - Sets `isAudioContext = true` before processing
   * - Mutex uses maximum 3 CAS spins (~300ns), no yield
   * - Immediate return on contention (no blocking)
   * - Restores `isAudioContext = false` after processing
   *
   * **Performance:**
   * - Processes max 256 commands per call to prevent audio starvation
   * - Each command: ~1-2us (linking only, allocation done by Main Thread)
   * - Zero allocations
   *
   * @returns Number of commands processed (0-256)
   *
   * @example
   * ```typescript
   * // In AudioWorklet.process()
   * process(inputs, outputs, parameters) {
   *   const processed = this.linker.poll()
   *   // Now process audio using the updated chain
   *   return true
   * }
   * ```
   *
   * @see processCommands - Lower-level API without audio context handling
   * @see setAudioContext - Manual context control for advanced use cases
   */
  poll(): number {
    // RFC-045-04 ISSUE-001: Set audio context for safe mutex behavior
    this.isAudioContext = true

    // RFC-056: Drain cross-zone returns first (no-op in legacy mode)
    this.freeList.drainReturnQueue()

    const result = this.processCommands()
    this.isAudioContext = false
    return result
  }

  // ===========================================================================
  // Test Helper Methods (RFC-045-FINAL)
  // ===========================================================================

  /**
   * Insert a node at head (test helper - routes through command ring).
   *
   * @internal This method is for test compatibility only. Production code
   * should use the Bridge's insertAsync() method.
   */
  insertHead(
    opcode: number,
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    sourceId: number,
    flags: number
  ): NodePtr {
    // Check safe zone before allocating
    if (!this.checkSafeZone(baseTick)) {
      return NULL_PTR
    }

    // Allocate node first
    const newPtr = this.allocNode()
    if (newPtr === NULL_PTR) {
      return NULL_PTR
    }

    // Write node data directly (Zone A allocation)
    const offset = this.nodeOffset(newPtr)
    this.writeNodeData(offset, opcode, pitch, velocity, duration, baseTick, sourceId, flags)

    // Queue INSERT command
    this.ringBuffer.write(CMD.INSERT, newPtr, NULL_PTR) // NULL_PTR = head insert

    // Process immediately
    this.processCommands()

    return newPtr
  }

  /**
   * Insert a node after another (test helper - routes through command ring).
   *
   * @internal This method is for test compatibility only.
   */
  insertNode(
    afterPtr: NodePtr,
    opcode: number,
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    sourceId: number,
    flags: number
  ): NodePtr {
    // Check safe zone using afterPtr's baseTick (insertion point)
    const afterOffset = this.nodeOffset(afterPtr)
    const targetTick = this.sab[afterOffset + NODE.BASE_TICK]
    if (!this.checkSafeZone(targetTick)) {
      return NULL_PTR
    }

    // Allocate node first
    const newPtr = this.allocNode()
    if (newPtr === NULL_PTR) {
      return NULL_PTR
    }

    // Write node data directly (Zone A allocation)
    const offset = this.nodeOffset(newPtr)
    this.writeNodeData(offset, opcode, pitch, velocity, duration, baseTick, sourceId, flags)

    // Queue INSERT command
    this.ringBuffer.write(CMD.INSERT, newPtr, afterPtr)

    // Process immediately
    this.processCommands()

    return newPtr
  }

  /**
   * Delete a node (test helper - routes through command ring).
   *
   * @internal This method is for test compatibility only.
   */
  deleteNode(ptr: NodePtr): boolean {
    if (ptr === NULL_PTR) return true

    // Check safe zone before deleting
    const offset = this.nodeOffset(ptr)
    // M-002: Use Atomics.load for thread-safe node field access
    const targetTick = Atomics.load(this.sab, offset + NODE.BASE_TICK)
    if (!this.checkSafeZone(targetTick)) {
      return false
    }

    // Queue DELETE command
    this.ringBuffer.write(CMD.DELETE, ptr, 0)

    // Process immediately
    this.processCommands()

    return true
  }
}
