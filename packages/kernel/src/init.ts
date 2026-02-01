// =============================================================================
// SymphonyScript - Silicon Linker SAB Initialization (RFC-043)
// =============================================================================
// Factory functions for creating and initializing SharedArrayBuffers.

import {
  SL_MAGIC,
  SL_VERSION,
  DEFAULT_PPQ,
  DEFAULT_BPM,
  DEFAULT_SAFE_ZONE_TICKS,
  HDR,
  REG,
  COMMIT,
  ERROR,
  NULL_PTR,
  calculateSABSize,
  getIdentityTableOffset,
  getSymbolTableOffset,
  getGrooveTemplateOffset,
  getZoneSplitIndex,
  getRingBufferOffset,
  DEFAULT_RING_CAPACITY,
  RECLAIM,
  getReclaimRingOffset,
  ID_TABLE,
  SYM_TABLE,
  REVERSE_INDEX,
  getReverseIndexOffset,
  SYNAPSE_TABLE,
  getSynapseTableOffset,
  ZONE_CONFIG,
  ZONE_CONFIG_STRIDE,
  getZoneConfigTableOffset,
  NODE_SIZE_BYTES,
  HEAP_START_OFFSET
} from './constants'
import { FreeList } from './free-list'
import { ReturnQueue } from './return-queue'
import type { LinkerConfig } from './types'

/**
 * Default configuration values.
 * Note: synapseCapacity is NOT included here - it's calculated dynamically
 * as nodeCapacity * 8 if not explicitly provided.
 * Note: workerZones defaults to 1 (legacy mode) for backward compatibility.
 */
const DEFAULT_CONFIG_BASE = {
  nodeCapacity: 4096,
  ppq: DEFAULT_PPQ,
  bpm: DEFAULT_BPM,
  safeZoneTicks: DEFAULT_SAFE_ZONE_TICKS,
  prngSeed: 12345,
  workerZones: 1
} as const

/**
 * Create and initialize a new SharedArrayBuffer for the Silicon Linker.
 *
 * The buffer is fully initialized with:
 * - Magic number and version
 * - Configuration values (PPQ, BPM, safe zone)
 * - Empty node chain (HEAD_PTR = NULL)
 * - Full free list (all nodes linked)
 * - Zeroed groove template region
 *
 * RFC-056: Supports multi-zone heap partitioning via workerZones parameter.
 * - workerZones: 1 (default) = legacy single-zone mode (no overhead)
 * - workerZones: N > 1 = multi-zone mode with N worker zones
 *
 * RFC-058: Zero-allocation error handling - returns null on invalid config.
 *
 * @param config - Optional configuration overrides
 * @returns Initialized SharedArrayBuffer, or null if config is invalid
 *
 * @remarks
 * - synapseCapacity must be a power of 2 (for hash mask optimization)
 * - workerZones must be between 1 and 8
 * - On error, returns null (caller should check)
 *
 * @example
 * ```typescript
 * const buffer = createLinkerSAB({ nodeCapacity: 4096 })
 * if (buffer === null) {
 *   // Handle invalid config
 * }
 * ```
 */
export function createLinkerSAB(config?: LinkerConfig): SharedArrayBuffer | null {
  const baseCfg = { ...DEFAULT_CONFIG_BASE, ...config }

  // K-002: Calculate effective synapse capacity
  // Use explicit config value if provided, otherwise default to nodeCapacity * 8
  const effectiveSynapseCapacity = config?.synapseCapacity ?? baseCfg.nodeCapacity * 8

  // RFC-056: Get effective worker zones (default: 1 for legacy mode)
  const effectiveWorkerZones = config?.workerZones ?? 1

  // RFC-058: Zero-allocation validation - return null instead of throwing
  // Validate synapse capacity is power of 2 (required for hash mask: & (capacity - 1))
  if (effectiveSynapseCapacity <= 0 || (effectiveSynapseCapacity & (effectiveSynapseCapacity - 1)) !== 0) {
    return null // ERROR.INVALID_SYNAPSE_CAPACITY - caller must validate config
  }

  // RFC-056/058: Validate worker zones (1-8 range)
  if (effectiveWorkerZones < 1 || effectiveWorkerZones > 8) {
    return null // ERROR.INVALID_WORKER_ZONES - caller must validate config
  }

  // Create full config with synapseCapacity for typed function calls
  const cfg: Required<LinkerConfig> = {
    ...baseCfg,
    synapseCapacity: effectiveSynapseCapacity,
    workerZones: effectiveWorkerZones
  }

  // Calculate total size needed (RFC-056: includes zone config + return queues when workerZones > 1)
  const totalBytes = calculateSABSize(cfg.nodeCapacity, effectiveSynapseCapacity, effectiveWorkerZones)

  // Create SharedArrayBuffer
  const buffer = new SharedArrayBuffer(totalBytes)
  const sab = new Int32Array(buffer)

  // Initialize header
  initializeHeader(sab, cfg)

  // K-002: Store synapse capacity in header
  sab[HDR.SYNAPSE_CAPACITY] = effectiveSynapseCapacity
  sab[HDR.SYNAPSE_COUNT] = 0

  // RFC-056: Store zone configuration in header
  sab[HDR.ZONE_COUNT] = effectiveWorkerZones
  const zoneConfigOffset = effectiveWorkerZones > 1 
    ? getZoneConfigTableOffset(cfg.nodeCapacity, effectiveSynapseCapacity)
    : 0
  sab[HDR.ZONE_CONFIG_OFFSET] = zoneConfigOffset

  // Initialize register bank
  initializeRegisters(sab, cfg)

  if (effectiveWorkerZones === 1) {
    // LEGACY MODE: Identical to current behavior
    // Initialize free list (RFC-044: Only Zone A, not Zone B)
    // Zone A is for Worker/Audio Thread SPSC allocation (RFC-055)
    // Zone B is reserved for Main Thread bump-pointer allocation (LocalAllocator)
    const zoneASize = getZoneSplitIndex(cfg.nodeCapacity)
    FreeList.initialize(sab, zoneASize, cfg.nodeCapacity)
  } else {
    // MULTI-ZONE MODE (RFC-056)
    initializeMultiZone(sab, cfg.nodeCapacity, effectiveWorkerZones)
  }

  // Initialize Identity Table
  initializeIdentityTable(sab, cfg.nodeCapacity)

  // Initialize Symbol Table
  initializeSymbolTable(sab, cfg.nodeCapacity)

  // Initialize Ring Buffer header (RFC-044)
  initializeRingBufferHeader(sab, cfg.nodeCapacity)

  // Initialize Reclaim Ring header (K-005)
  initializeReclaimRingHeader(sab, cfg.nodeCapacity)

  // Initialize Reverse Index table (ISSUE-016) - K-002: pass dynamic capacity
  initializeReverseIndex(sab, cfg.nodeCapacity, effectiveSynapseCapacity)

  // Initialize Synapse Table (K-002: dynamic capacity)
  initializeSynapseTable(sab, cfg.nodeCapacity, effectiveSynapseCapacity)

  return buffer
}

/**
 * Initialize multi-zone heap partitioning (RFC-056).
 *
 * Divides the worker heap (Zone A) into N equal-sized zones, each with:
 * - Its own FreeList
 * - Its own Return Queue for cross-zone frees
 * - Zone config entry in the Zone Config Table
 *
 * @param sab - Int32Array view of SharedArrayBuffer
 * @param nodeCapacity - Total node capacity
 * @param workerZones - Number of worker zones
 */
function initializeMultiZone(sab: Int32Array, nodeCapacity: number, workerZones: number): void {
  // Read zone config offset from header (set by createLinkerSAB)
  const zoneConfigOffset = sab[HDR.ZONE_CONFIG_OFFSET]

  // Calculate total worker nodes (Zone B excluded)
  const totalWorkerNodes = getZoneSplitIndex(nodeCapacity)
  const nodesPerZone = Math.floor(totalWorkerNodes / workerZones)

  // Initialize each zone's config, FreeList, and Return Queue
  let z = 0
  while (z < workerZones) {
    const heapStartBytes = HEAP_START_OFFSET + z * nodesPerZone * NODE_SIZE_BYTES
    const heapEndBytes = heapStartBytes + nodesPerZone * NODE_SIZE_BYTES

    // Initialize zone's FreeList
    FreeList.initializeZone(sab, z, heapStartBytes, heapEndBytes, nodesPerZone, zoneConfigOffset)

    // Initialize zone's Return Queue
    ReturnQueue.initialize(sab, z, workerZones)

    z = z + 1
  }

  // Set global header fields for multi-zone
  sab[HDR.HEAD_PTR] = NULL_PTR // Empty chain initially
  sab[HDR.FREE_COUNT] = totalWorkerNodes // Total free nodes across all zones
  sab[HDR.NODE_COUNT] = 0
  sab[HDR.NODE_CAPACITY] = nodeCapacity // Total capacity (all zones + Zone B)
  sab[HDR.HEAP_START] = HEAP_START_OFFSET
}

/**
 * Initialize the header region (offsets 0-15).
 */
function initializeHeader(
  sab: Int32Array,
  cfg: Required<LinkerConfig>
): void {
  // Identity
  sab[HDR.MAGIC] = SL_MAGIC
  sab[HDR.VERSION] = SL_VERSION

  // Timing
  sab[HDR.PPQ] = cfg.ppq
  sab[HDR.BPM] = cfg.bpm

  // Pointers (initialized by FreeList.initialize)
  // sab[HDR.HEAD_PTR] = NULL_PTR
  // sab[HDR.FREE_LIST_PTR] = ...

  // Synchronization
  sab[HDR.COMMIT_FLAG] = COMMIT.IDLE
  sab[HDR.PLAYHEAD_TICK] = 0
  sab[HDR.SAFE_ZONE_TICKS] = cfg.safeZoneTicks
  sab[HDR.ERROR_FLAG] = ERROR.OK

  // Counters (initialized by FreeList.initialize)
  // sab[HDR.NODE_COUNT] = 0
  // sab[HDR.FREE_COUNT] = cfg.nodeCapacity
  // sab[HDR.NODE_CAPACITY] = cfg.nodeCapacity
  // sab[HDR.HEAP_START] = HEAP_START_OFFSET
}

/**
 * Initialize the register bank (offsets 16-31).
 */
function initializeRegisters(
  sab: Int32Array,
  cfg: Required<LinkerConfig>
): void {
  // Groove (disabled by default)
  sab[REG.GROOVE_PTR] = NULL_PTR
  sab[REG.GROOVE_LEN] = 0

  // Humanization (disabled by default)
  sab[REG.HUMAN_TIMING_PPT] = 0
  sab[REG.HUMAN_VEL_PPT] = 0

  // Global transforms
  sab[REG.TRANSPOSE] = 0
  sab[REG.VELOCITY_MULT] = 1000 // 1.0 in parts per thousand

  // PRNG
  sab[REG.PRNG_SEED] = cfg.prngSeed
}

/**
 * Initialize the Identity Table region.
 *
 * The Identity Table is a quadratic-probe hash table mapping TID (sourceId) to NodePtr.
 * Uses slot = (baseSlot + probe²) % capacity to reduce primary clustering.
 * All slots are initialized to EMPTY_TID (0) to indicate empty.
 *
 * Header fields set:
 * - HDR.ID_TABLE_PTR: Byte offset to the Identity Table
 * - HDR.ID_TABLE_CAPACITY: Total number of slots
 * - HDR.ID_TABLE_USED: 0 (no entries initially)
 */
function initializeIdentityTable(sab: Int32Array, nodeCapacity: number): void {
  const tableOffset = getIdentityTableOffset(nodeCapacity)
  const tableOffsetI32 = tableOffset / 4

  // RFC-047-50: Use 2x capacity to keep load factor under 50% for better performance
  const tableCapacity = nodeCapacity * 2

  // Set header fields
  sab[HDR.ID_TABLE_PTR] = tableOffset
  sab[HDR.ID_TABLE_CAPACITY] = tableCapacity
  sab[HDR.ID_TABLE_USED] = 0

  // Clear all slots to EMPTY_TID (0)
  // Each entry is 2 × i32: [TID, NodePtr]
  const totalI32 = tableCapacity * ID_TABLE.ENTRY_SIZE_I32
  let i = 0
  while (i < totalI32) {
    sab[tableOffsetI32 + i] = 0
    i = i + 1
  }
}

/**
 * Initialize the Symbol Table region.
 *
 * The Symbol Table maps sourceId → packed SourceLocation for editor integration.
 * All entries are initialized to EMPTY_ENTRY (0) to indicate no location stored.
 *
 * The Symbol Table shares the same capacity as the Identity Table and uses
 * the same slot index for corresponding sourceIds.
 */
function initializeSymbolTable(sab: Int32Array, nodeCapacity: number): void {
  const tableOffset = getSymbolTableOffset(nodeCapacity)
  const tableOffsetI32 = tableOffset / 4

  // Clear all entries to EMPTY_ENTRY (0)
  // Each entry is 2 × i32: [fileHash, lineCol]
  // Must match Identity Table capacity (2x nodeCapacity)
  const totalI32 = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_I32
  let i = 0
  while (i < totalI32) {
    sab[tableOffsetI32 + i] = 0
    i = i + 1
  }
}

/**
 * Initialize the Command Ring Buffer header (RFC-044).
 *
 * The Ring Buffer header fields must be initialized here (not in RingBuffer constructor)
 * to ensure the SAB is fully formatted before any threads access it.
 *
 * **Critical Hygiene:**
 * If the Worker starts before the Main Thread instantiates RingBuffer, it must see
 * valid header fields. This function ensures the SAB is "pre-formatted" for RFC-044.
 *
 * Header fields initialized:
 * - HDR.RB_CAPACITY: Maximum commands that can be queued
 * - HDR.COMMAND_RING_PTR: Byte offset to ring buffer data region
 * - HDR.RB_HEAD: Read index (initially 0, empty)
 * - HDR.RB_TAIL: Write index (initially 0, empty)
 */
function initializeRingBufferHeader(sab: Int32Array, nodeCapacity: number): void {
  // Set capacity (fixed at compile time)
  Atomics.store(sab, HDR.RB_CAPACITY, DEFAULT_RING_CAPACITY)

  // Calculate and store data region pointer
  const ringOffset = getRingBufferOffset(nodeCapacity)
  Atomics.store(sab, HDR.COMMAND_RING_PTR, ringOffset)

  // Initialize indices (empty ring: head === tail)
  Atomics.store(sab, HDR.RB_HEAD, 0)
  Atomics.store(sab, HDR.RB_TAIL, 0)
}

/**
 * Initialize the Reclaim Ring Buffer header (K-005).
 *
 * The Reclaim Ring (Worker -> Main) is used to recycle Zone B nodes.
 *
 * Header fields initialized:
 * - RECLAIM.RB_CAPACITY: Maximum pointers that can be queued
 * - RECLAIM.RECLAIM_RING_PTR: Byte offset to ring buffer data region
 * - RECLAIM.RECLAIM_RB_HEAD: Read index (initially 0, empty)
 * - RECLAIM.RECLAIM_RB_TAIL: Write index (initially 0, empty)
 */
function initializeReclaimRingHeader(sab: Int32Array, nodeCapacity: number): void {
  // Set capacity (fixed at compile time)
  // RECLAIM.DEFAULT_RING_SIZE_BYTES is 16384 (16KB)
  // Each entry is 1 i32 (4 bytes)
  const capacity = 4096
  Atomics.store(sab, HDR.RECLAIM_RB_CAPACITY, capacity)

  // Calculate and store data region pointer
  // Reclaim Ring follows Command Ring immediately
  const ringOffset = getReclaimRingOffset(nodeCapacity)
  Atomics.store(sab, HDR.RECLAIM_RING_PTR, ringOffset)

  // Initialize indices (empty ring: head === tail)
  Atomics.store(sab, HDR.RECLAIM_RB_HEAD, 0)
  Atomics.store(sab, HDR.RECLAIM_RB_TAIL, 0)
}

/**
 * Initialize the Reverse Index table (ISSUE-016).
 *
 * The Reverse Index maps TARGET_PTR → linked list of synapses for O(k) disconnect.
 * All buckets are initialized to EMPTY (-1) to indicate no synapses in that bucket.
 *
 * @param sab - Int32Array view of the SharedArrayBuffer
 * @param nodeCapacity - Number of nodes in the SAB (used to calculate offset)
 * @param synapseCapacity - Maximum number of synapses (K-002 dynamic)
 */
function initializeReverseIndex(sab: Int32Array, nodeCapacity: number, synapseCapacity: number): void {
  const reverseIndexOffset = getReverseIndexOffset(nodeCapacity, synapseCapacity)
  const reverseIndexI32 = reverseIndexOffset / 4

  // Initialize all buckets to EMPTY (-1)
  let bucket = 0
  while (bucket < REVERSE_INDEX.BUCKET_COUNT) {
    sab[reverseIndexI32 + bucket] = REVERSE_INDEX.EMPTY
    bucket = bucket + 1
  }
}

/**
 * Initialize the Synapse Table region (K-002: dynamic capacity).
 *
 * While SharedArrayBuffer is zero-initialized by spec, we explicitly clear the
 * Synapse Table to:
 * 1. Document intent that all entries start empty
 * 2. Support future non-zero sentinel values if needed
 * 3. Ensure consistent behavior across all platforms
 *
 * Each synapse entry is 5 × i32: [SOURCE_PTR, TARGET_PTR, WEIGHT_DATA, META_NEXT, NEXT_SAME_TARGET]
 *
 * @param sab - Int32Array view of the SharedArrayBuffer
 * @param nodeCapacity - Number of nodes in the SAB (used to calculate offset)
 * @param synapseCapacity - Maximum number of synapses (K-002)
 */
function initializeSynapseTable(sab: Int32Array, nodeCapacity: number, synapseCapacity: number): void {
  const tableOffset = getSynapseTableOffset(nodeCapacity)
  const tableOffsetI32 = tableOffset / 4
  const totalI32 = synapseCapacity * SYNAPSE_TABLE.STRIDE_I32

  // Zero all synapse entries
  let i = 0
  while (i < totalI32) {
    sab[tableOffsetI32 + i] = 0
    i = i + 1
  }
}

/**
 * Validate that a SharedArrayBuffer has the correct Silicon Linker format.
 *
 * @param buffer - Buffer to validate
 * @returns true if valid, false otherwise
 */
export function validateLinkerSAB(buffer: SharedArrayBuffer): boolean {
  if (buffer.byteLength < 128) {
    return false // Too small for header + registers
  }

  const sab = new Int32Array(buffer)

  // Check magic number
  if (sab[HDR.MAGIC] !== SL_MAGIC) {
    return false
  }

  // Check version
  if (sab[HDR.VERSION] !== SL_VERSION) {
    return false
  }

  // Check that node capacity is reasonable
  const nodeCapacity = sab[HDR.NODE_CAPACITY]
  if (nodeCapacity <= 0 || nodeCapacity > 1000000) {
    return false
  }

  // Check buffer size matches expected
  const expectedSize = calculateSABSize(nodeCapacity)
  if (buffer.byteLength < expectedSize) {
    return false
  }

  return true
}

/**
 * Get configuration values from an existing SAB.
 *
 * @param buffer - Initialized SharedArrayBuffer
 * @returns Configuration extracted from the buffer
 */
export function getLinkerConfig(buffer: SharedArrayBuffer): Required<LinkerConfig> {
  const sab = new Int32Array(buffer)

  return {
    nodeCapacity: sab[HDR.NODE_CAPACITY],
    synapseCapacity: sab[HDR.SYNAPSE_CAPACITY],
    ppq: sab[HDR.PPQ],
    bpm: sab[HDR.BPM],
    safeZoneTicks: sab[HDR.SAFE_ZONE_TICKS],
    prngSeed: sab[REG.PRNG_SEED],
    workerZones: sab[HDR.ZONE_COUNT] || 1
  }
}

/**
 * Reset an existing SAB to initial state.
 * Clears all nodes and resets to empty chain with full free list.
 *
 * WARNING: This is NOT thread-safe. Only call when no other threads
 * are accessing the buffer.
 *
 * RFC-056: Handles both legacy and multi-zone modes.
 *
 * @param buffer - SharedArrayBuffer to reset
 */
export function resetLinkerSAB(buffer: SharedArrayBuffer): void {
  const sab = new Int32Array(buffer)
  const nodeCapacity = sab[HDR.NODE_CAPACITY]
  const workerZones = sab[HDR.ZONE_COUNT] || 1

  // Reset synchronization state
  sab[HDR.COMMIT_FLAG] = COMMIT.IDLE
  sab[HDR.PLAYHEAD_TICK] = 0
  sab[HDR.ERROR_FLAG] = ERROR.OK

  if (workerZones === 1) {
    // LEGACY MODE: Re-initialize free list (RFC-044: Only Zone A, not Zone B)
    // RFC-055: SPSC implementation — no BigInt64Array needed
    const zoneASize = getZoneSplitIndex(nodeCapacity)
    FreeList.initialize(sab, zoneASize, nodeCapacity)
  } else {
    // MULTI-ZONE MODE (RFC-056): Re-initialize all zones
    initializeMultiZone(sab, nodeCapacity, workerZones)
  }

  // Re-initialize Identity Table
  initializeIdentityTable(sab, nodeCapacity)

  // Re-initialize Symbol Table
  initializeSymbolTable(sab, nodeCapacity)

  // Re-initialize Ring Buffer header (RFC-044)
  initializeRingBufferHeader(sab, nodeCapacity)

  // Re-initialize Reclaim Ring header (K-005)
  initializeReclaimRingHeader(sab, nodeCapacity)

  // Re-initialize Reverse Index table (ISSUE-016) - K-002: use dynamic capacity
  const synapseCapacity = sab[HDR.SYNAPSE_CAPACITY]
  initializeReverseIndex(sab, nodeCapacity, synapseCapacity)

  // Re-initialize Synapse Table (K-002: read capacity from header)
  initializeSynapseTable(sab, nodeCapacity, synapseCapacity)
  sab[HDR.SYNAPSE_COUNT] = 0
}

/**
 * Write a groove template to the SAB.
 *
 * RFC-045-04: Accepts ArrayLike<number> (both number[] and Int32Array).
 *
 * Groove template format in SAB:
 * - [0] Length (number of steps)
 * - [1..N] Tick offsets for each step
 *
 * @param buffer - SharedArrayBuffer
 * @param templateIndex - Which template slot (0-based)
 * @param offsets - ArrayLike of tick offsets for each step
 * @param count - Number of offsets to write (if less than offsets.length)
 */
export function writeGrooveTemplate(
  buffer: SharedArrayBuffer,
  templateIndex: number,
  offsets: ArrayLike<number>,
  count?: number
): void {
  const sab = new Int32Array(buffer)
  const nodeCapacity = sab[HDR.NODE_CAPACITY]
  // Groove templates are after Identity Table
  const grooveStart = getGrooveTemplateOffset(nodeCapacity) / 4 // Convert byte offset to i32 index

  // Each template: 17 i32s (1 length + 16 max offsets)
  const templateSize = 17
  const templateOffset = grooveStart + templateIndex * templateSize

  const offsetCount = count ?? offsets.length

  // Write length
  sab[templateOffset] = Math.min(offsetCount, 16)

  // Write offsets (max 16 steps) - zero-alloc while loop
  let i = 0
  while (i < 16) {
    sab[templateOffset + 1 + i] = i < offsetCount ? (offsets[i] | 0) : 0
    i = i + 1
  }
}

/**
 * Read a groove template from the SAB.
 *
 * RFC-045-04: Zero-allocation API - caller provides output array.
 * For backward compatibility (tests), can be called without output array.
 *
 * @param buffer - SharedArrayBuffer
 * @param templateIndex - Which template slot (0-based)
 * @param outOffsets - Pre-allocated Int32Array to receive offsets (optional for tests)
 * @returns Number of offsets read (if outOffsets provided), or array of offsets (if not)
 */
export function readGrooveTemplate(
  buffer: SharedArrayBuffer,
  templateIndex: number,
  outOffsets?: Int32Array
): number | number[] {
  const sab = new Int32Array(buffer)
  const nodeCapacity = sab[HDR.NODE_CAPACITY]
  // Groove templates are after Identity Table
  const grooveStart = getGrooveTemplateOffset(nodeCapacity) / 4

  const templateSize = 17
  const templateOffset = grooveStart + templateIndex * templateSize

  const length = sab[templateOffset]

  // Zero-allocation path: caller provides output array
  if (outOffsets !== undefined) {
    let i = 0
    while (i < length && i < outOffsets.length) {
      outOffsets[i] = sab[templateOffset + 1 + i]
      i = i + 1
    }
    return length
  }

  // Legacy path (for tests): allocate and return array
  const offsets: number[] = []
  let i = 0
  while (i < length) {
    offsets[i] = sab[templateOffset + 1 + i]
    i = i + 1
  }
  return offsets
}
