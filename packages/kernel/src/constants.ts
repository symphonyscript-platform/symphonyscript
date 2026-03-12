// =============================================================================
// SymphonyScript - Silicon Linker Constants (RFC-043)
// =============================================================================
// Memory layout and constants for Direct-to-Silicon Mirroring architecture.

/**
 * Magic number identifying Silicon Linker SAB format: "SYMB" as ASCII bytes.
 */
export const SL_MAGIC = 0x53594d42

/**
 * Current Silicon Linker format version.
 */
export const SL_VERSION = 0x01

/**
 * Default pulses per quarter note.
 */
export const DEFAULT_PPQ = 480

/**
 * Default tempo in BPM.
 */
export const DEFAULT_BPM = 120

/**
 * Default safe zone in ticks (2 beats at 480 PPQ).
 */
export const DEFAULT_SAFE_ZONE_TICKS = 960

/**
 * Null pointer value (end of chain / empty).
 */
export const NULL_PTR = 0

/**
 * Knuth's multiplicative hash constant (golden ratio × 2^32).
 * Used for all hash table operations (Identity Table, Synapse Table).
 * Value: floor(2^32 / φ) where φ = (1 + √5) / 2 = 0x9E3779B1
 *
 * RFC-045-01: This is the canonical constant for all hash operations.
 */
export const KNUTH_HASH_CONST = 2654435761

// =============================================================================
// PHYSICAL MEMORY MAP (v2.0 - RFC-045)
// =============================================================================
/**
 * SharedArrayBuffer Memory Layout
 *
 * The Silicon Linker uses a carefully structured SharedArrayBuffer with the
 * following regions (all offsets in bytes):
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HEADER REGION (0-60)                                    64 bytes    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Offset | i32 Index | Field              | Type    | Description    │
 * ├────────┼───────────┼────────────────────┼─────────┼────────────────┤
 * │ 0      │ 0         │ MAGIC              │ u32     │ 0x53594D42     │
 * │ 4      │ 1         │ VERSION            │ u32     │ Format version │
 * │ 8      │ 2         │ PPQ                │ u32     │ Pulses/quarter │
 * │ 12     │ 3         │ BPM                │ u32     │ Tempo          │
 * │ 16     │ 4         │ HEAD_PTR           │ u32     │ First node     │
 * │ 20     │ 5         │ DEBUG_FLAGS        │ u32     │ Runtime debug  │
 * │ 24-31  │ 6-7       │ FREE_LIST_HEAD     │ i64     │ Ver+Ptr (ABA)  │
 * │ 32     │ 8         │ COMMIT_FLAG        │ u32     │ 0/1/2 sync     │
 * │ 36     │ 9         │ PLAYHEAD_TICK      │ u32     │ Audio position │
 * │ 40     │ 10        │ SAFE_ZONE_TICKS    │ u32     │ Edit boundary  │
 * │ 44     │ 11        │ ERROR_FLAG         │ u32     │ Error bitmask  │
 * │ 48     │ 12        │ NODE_COUNT         │ u32     │ Live nodes     │
 * │ 52     │ 13        │ FREE_COUNT         │ u32     │ Free nodes     │
 * │ 56     │ 14        │ NODE_CAPACITY      │ u32     │ Max nodes      │
 * │ 60     │ 15        │ HEAP_START         │ u32     │ Heap offset    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ REGISTER BANK (64-88)                                   28 bytes    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ 64     │ 16        │ GROOVE_PTR         │ u32     │ Groove table   │
 * │ 68     │ 17        │ GROOVE_LEN         │ u32     │ Steps count    │
 * │ 72     │ 18        │ HUMAN_TIMING_PPT   │ u32     │ Timing jitter  │
 * │ 76     │ 19        │ HUMAN_VEL_PPT      │ u32     │ Velocity jit.  │
 * │ 80     │ 20        │ TRANSPOSE          │ i32     │ Semitones      │
 * │ 84     │ 21        │ VELOCITY_MULT      │ u32     │ Velocity ×1000 │
 * │ 88     │ 22        │ PRNG_SEED          │ u32     │ RNG seed       │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ EXTENDED HEADER (92-124) [v1.5]                        36 bytes    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ 92     │ 23        │ ID_TABLE_PTR       │ u32     │ TID hash table │
 * │ 96     │ 24        │ UPDATE_PASS_ID     │ u32     │ Generation ID  │
 * │ 100    │ 25        │ CHAIN_MUTEX        │ u32     │ 0=unlk, 1=lock │
 * │ 104    │ 26        │ ID_TABLE_CAPACITY  │ u32     │ Table slots    │
 * │ 108    │ 27        │ ID_TABLE_USED      │ u32     │ Used slots     │
 * │ 112    │ 28        │ TELEMETRY_OPS_LOW  │ u32     │ Ops count LOW  │
 * │ 116    │ 29        │ TELEMETRY_OPS_HIGH │ u32     │ Ops count HIGH │
 * │ 120    │ 30        │ YIELD_SLOT         │ u32     │ Atomics.wait   │
 * │ 124    │ 31        │ PLAYBACK_OFFSET    │ u32     │ Latency (ms)   │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ NODE HEAP (128+)                             nodeCapacity × 32 bytes│
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Each node: 8 × i32 = 32 bytes (doubly-linked, cache-aligned)       │
 * │   [+0] PACKED_A     : (opcode<<24)|(pitch<<16)|(vel<<8)|flags      │
 * │   [+4] BASE_TICK    : Grid-aligned timing (pre-transform)          │
 * │   [+8] DURATION     : Duration in ticks                             │
 * │   [+12] NEXT_PTR    : Byte offset to next node (0=end)             │
 * │   [+16] PREV_PTR    : Byte offset to prev node (0=head)            │
 * │   [+20] SOURCE_ID   : Editor hash / Temporal ID (TID)              │
 * │   [+24] SEQ_FLAGS   : (sequence<<8)|flags_ext (versioning)         │
 * │   [+28] LAST_PASS_ID: Generation ID for zero-alloc pruning [v1.5]  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ IDENTITY TABLE (dynamic offset)              capacity × 8 bytes    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Triangular-number probe hash table: [TID: i32, NodePtr: u32] × cap  │
 * │   TID = 0  : Empty slot                                             │
 * │   TID = -1 : Tombstone (deleted, will be cleaned on rebuild)       │
 * │   TID > 0  : Active entry (Knuth multiplicative hash)              │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ SYMBOL TABLE (dynamic offset)                capacity × 8 bytes    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Packed SourceLocation: [fileHash: i32, lineCol: i32] × capacity    │
 * │   fileHash = 0: No location stored                                  │
 * │   lineCol = (line << 16) | (column & 0xFFFF)                       │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ GROOVE TEMPLATES (dynamic offset)                      1024 bytes  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Fixed-size region for groove template patterns (humanization)      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ COMMAND RING BUFFER (dynamic offset) [RFC-044]         1MB        │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Circular buffer for zero-blocking structural edits (65536 commands, Task 060) │
 * │ Each command: 4 × i32 = 16 bytes [OPCODE, PARAM_1, PARAM_2, RSV]  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ SYNAPSE TABLE (dynamic offset) [RFC-045]               1MB        │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ The Silicon Brain: Linear-probe hash table (65536 synapses)        │
 * │ Each synapse: 4 × i32 = 16 bytes (neuromorphic connection)        │
 * │   [+0] SOURCE_PTR   : Trigger node (hash key for lookup)          │
 * │   [+4] TARGET_PTR   : Destination node (signal target)            │
 * │   [+8] WEIGHT_DATA  : weight(16b) | jitter(16b)                   │
 * │   [+12] META_NEXT   : plasticity(8b) | nextSynapse(24b)           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ATOMIC OPERATIONS:
 * - All fields marked [ATOMIC] in HDR use Atomics.load/store/compareExchange
 * - Chain Mutex (HDR.CHAIN_MUTEX): Protects ALL structural mutations
 * - Sequence Counter (NODE.SEQ_FLAGS): Versioned reads prevent torn data
 * - Yield Slot (HDR.YIELD_SLOT): Coordination point for Atomics.wait()
 *
 * CONCURRENCY MODEL (v1.5):
 * - Writers: Acquire Chain Mutex → Mutate → Increment SEQ → Release Mutex
 * - Readers: Versioned read loop (seq1, data, seq2) with hybrid CPU yield
 * - Dead-Man's Switch: Panic after 1M mutex iterations (crashed worker)
 * - Hash Table Rebuild: Defrag clears all tombstones, restores O(1) perf
 */

// =============================================================================
// Header Offsets (0-15) - 64 bytes = 16 × i32
// =============================================================================

/**
 * Header register offsets within the SAB.
 * All offsets are i32 indices (multiply by 4 for byte offset).
 */
export const HDR = {
  /** Magic number (0x53594D42 = "SYMB") */
  MAGIC: 0,
  /** Format version */
  VERSION: 1,
  /** Pulses per quarter note */
  PPQ: 2,
  /** Tempo in BPM (can be updated live) */
  BPM: 3,
  /** [ATOMIC] Byte offset to first node in chain (0 = empty) */
  HEAD_PTR: 4,
  /** [Task 077] Runtime debug flags (replaces process.env.NODE_ENV) */
  DEBUG_FLAGS: 5,
  /** [ATOMIC] 64-bit tagged pointer (version|ptr) - occupies i32 indices 6-7 */
  FREE_LIST_HEAD_LOW: 6,
  /** Upper 32 bits of FREE_LIST_HEAD (access via BigInt64Array) */
  FREE_LIST_HEAD_HIGH: 7,
  /** [ATOMIC] Commit flag: IDLE=0, PENDING=1, ACK=2 */
  COMMIT_FLAG: 8,
  /** [ATOMIC] Current playhead tick (written by AudioWorklet) */
  PLAYHEAD_TICK: 9,
  /** Safe zone distance in ticks (structural edits blocked within) */
  SAFE_ZONE_TICKS: 10,
  /** [ATOMIC] Error bitmask flag: 0=OK, non-zero=one or more error bits set */
  ERROR_FLAG: 11,
  /** [ATOMIC] Total allocated nodes (live chain) */
  NODE_COUNT: 12,
  /** [ATOMIC] Nodes in free list */
  FREE_COUNT: 13,
  /** Total node capacity (set at init) */
  NODE_CAPACITY: 14,
  /** Byte offset where node heap begins */
  HEAP_START: 15,

  // -------------------------------------------------------------------------
  // Extended Header Fields (v1.5) - Using REG reserved slots 23-31
  // -------------------------------------------------------------------------
  // These fields extend the header using previously reserved register slots.
  // Byte offsets are used to maintain consistency with atomic operations.

  /** [v1.5] Byte offset to Identity Table (TID → NodePtr hash map) */
  ID_TABLE_PTR: 23,
  /** [v1.5] Current generation ID for pruning (incremented on beginUpdate) */
  UPDATE_PASS_ID: 24,
  /** [v1.5] [ATOMIC] Chain Mutex for structural operations (0=unlocked, 1=locked) */
  CHAIN_MUTEX: 25,
  /** [v1.5] Identity Table capacity (total slots) */
  ID_TABLE_CAPACITY: 26,
  /** [v1.5] [ATOMIC] Identity Table used slots (active + tombstones) */
  ID_TABLE_USED: 27,
  /** [v1.5] [ATOMIC] Telemetry: Total operations LOW 32 bits */
  TELEMETRY_OPS_LOW: 28,
  /** [v1.5] [ATOMIC] Telemetry: Total operations HIGH 32 bits */
  TELEMETRY_OPS_HIGH: 29,
  /** [v1.5] Dedicated slot for Atomics.wait() yield coordination */
  YIELD_SLOT: 30,
  /** [RFC-047 Phase 8 Task 4] Playback offset in milliseconds for latency compensation */
  PLAYBACK_OFFSET: 31,

  // -------------------------------------------------------------------------
  // Command Ring Buffer Header (RFC-044)
  // -------------------------------------------------------------------------
  /** [RFC-044] [ATOMIC] Ring Buffer Read Index (Worker consumes from here) */
  RB_HEAD: 32,
  /** [RFC-044] [ATOMIC] Ring Buffer Write Index (Main Thread produces here) */
  RB_TAIL: 33,
  /** [RFC-044] Ring Buffer capacity in commands (fixed at init) */
  RB_CAPACITY: 34,
  /** [RFC-044] Byte offset to Command Ring Buffer data region */
  COMMAND_RING_PTR: 35,

  // -------------------------------------------------------------------------
  // Reclaim Ring Buffer Header (K-005)
  // -------------------------------------------------------------------------
  /** [K-005] [ATOMIC] Reclaim Ring Read Index (Main consumes) */
  RECLAIM_RB_HEAD: 36,
  /** [K-005] [ATOMIC] Reclaim Ring Write Index (Worker produces) */
  RECLAIM_RB_TAIL: 37,
  /** [K-005] Reclaim Ring capacity (fixed at init) */
  RECLAIM_RB_CAPACITY: 38,
  /** [K-005] Byte offset to Reclaim Ring data region */
  RECLAIM_RING_PTR: 39,

  // -------------------------------------------------------------------------
  // Synapse Table Header (K-002)
  // -------------------------------------------------------------------------
  /** [K-002] Maximum number of synapses (dynamic, defaults to nodeCapacity * 8) */
  SYNAPSE_CAPACITY: 40,
  /** [K-002] [ATOMIC] Current number of active synapses */
  SYNAPSE_COUNT: 41,

  // -------------------------------------------------------------------------
  // Multi-Zone Header (RFC-056)
  // -------------------------------------------------------------------------
  /** [RFC-056] Number of worker zones (1 = legacy single-zone mode) */
  ZONE_COUNT: 42,
  /** [RFC-056] Byte offset to zone configuration table (0 = legacy mode) */
  ZONE_CONFIG_OFFSET: 43,

  // -------------------------------------------------------------------------
  // Synapse Counter Header (RFC-059 R-007)
  // -------------------------------------------------------------------------
  /** [RFC-059 R-007] [ATOMIC] Synapse table total used slots (live + tombstones) */
  SYNAPSE_USED_SLOTS: 44,
  /** [RFC-059 R-007] [ATOMIC] Synapse table tombstone count */
  SYNAPSE_TOMBSTONES: 45
} as const

/**
 * Header register offsets for BigInt64Array access.
 * Use this for 64-bit atomic operations on tagged pointers.
 *
 * @deprecated RFC-055: FREE_LIST_HEAD is no longer used after SPSC migration.
 * The FreeList now uses HDR.FREE_LIST_HEAD_LOW (32-bit) instead.
 * This constant is retained for backward compatibility and potential future use.
 */
export const HDR_I64 = {
  /**
   * 64-bit tagged pointer: (version << 32n) | (ptr & 0xFFFFFFFFn)
   *
   * @deprecated RFC-055: Use HDR.FREE_LIST_HEAD_LOW instead.
   * SPSC FreeList does not need version counter — ABA problem doesn't exist
   * with single-threaded access.
   */
  FREE_LIST_HEAD: 3 // Byte offset 24 / 8 = i64 index 3
} as const

// =============================================================================
// Register Bank Offsets (16-22) - 28 bytes = 7 × i32
// =============================================================================

/**
 * Live transform registers for VM-resident math.
 * These can be updated at any time for instant feedback.
 *
 * NOTE: Indices 23-31 are now used by Extended Header Fields (v1.5).
 * See HDR.ID_TABLE_PTR through HDR.RESERVED_31 above.
 */
export const REG = {
  /** Byte offset to active groove template (0 = no groove) */
  GROOVE_PTR: 16,
  /** Groove template length in steps */
  GROOVE_LEN: 17,
  /** Humanize timing jitter (parts per thousand of PPQ) */
  HUMAN_TIMING_PPT: 18,
  /** Humanize velocity jitter (parts per thousand) */
  HUMAN_VEL_PPT: 19,
  /** Global transposition in semitones (signed) */
  TRANSPOSE: 20,
  /** Global velocity multiplier (parts per thousand, 1000 = 1.0) */
  VELOCITY_MULT: 21,
  /** PRNG seed for deterministic humanization */
  PRNG_SEED: 22
  // Indices 23-31: See HDR extended fields above
} as const

// =============================================================================
// Node Heap Layout (Doubly-Linked List)
// =============================================================================

/**
 * Node structure offsets (8 × i32 = 32 bytes per node).
 *
 * 32-byte stride provides optimal cache alignment and room for
 * doubly-linked list pointers enabling O(1) deletion.
 *
 * Layout:
 * - [+0] PACKED_A: (opcode << 24) | (pitch << 16) | (velocity << 8) | flags
 * - [+1] BASE_TICK: Grid-aligned timing (pre-transform)
 * - [+2] DURATION: Duration in ticks
 * - [+3] NEXT_PTR: Byte offset to next node (0 = end of chain)
 * - [+4] PREV_PTR: Byte offset to previous node (0 = head of chain)
 * - [+5] SOURCE_ID: Editor location hash / TID for bidirectional mapping
 * - [+6] SEQ_FLAGS: (sequence << 8) | flags_extended
 * - [+7] LAST_PASS_ID: [v1.5] Generation ID for zero-alloc pruning
 */
export const NODE = {
  /** Packed opcode, pitch, velocity, flags */
  PACKED_A: 0,
  /** Base tick (grid-aligned, pre-transform) */
  BASE_TICK: 1,
  /** Duration in ticks */
  DURATION: 2,
  /** Next pointer (byte offset, 0 = end) */
  NEXT_PTR: 3,
  /** Previous pointer (byte offset, 0 = head) */
  PREV_PTR: 4,
  /** Source ID (editor location hash) / Temporal ID (TID) for Identity Table */
  SOURCE_ID: 5,
  /** Sequence counter (upper 24 bits) + extended flags (lower 8 bits) */
  SEQ_FLAGS: 6,
  /** [v1.5] Last update pass ID (generation-based pruning) */
  LAST_PASS_ID: 7
} as const

/**
 * Node size in i32 units.
 */
export const NODE_SIZE_I32 = 8

/**
 * Node size in bytes.
 */
export const NODE_SIZE_BYTES = NODE_SIZE_I32 * 4

// =============================================================================
// Packed Field Bit Layouts
// =============================================================================

/**
 * PACKED_A field bit positions and masks.
 * Format: (opcode << 24) | (pitch << 16) | (velocity << 8) | flags
 */
export const PACKED = {
  /** Opcode: bits 24-31 */
  OPCODE_SHIFT: 24,
  OPCODE_MASK: 0xff000000,
  /** Pitch: bits 16-23 */
  PITCH_SHIFT: 16,
  PITCH_MASK: 0x00ff0000,
  /** Velocity: bits 8-15 */
  VELOCITY_SHIFT: 8,
  VELOCITY_MASK: 0x0000ff00,
  /** Flags: bits 0-7 */
  FLAGS_MASK: 0x000000ff
} as const

/**
 * SEQ_FLAGS field bit positions.
 * Format: (sequence << 8) | flags_extended
 */
export const SEQ = {
  /** Sequence counter: bits 8-31 (24-bit counter) */
  SEQ_SHIFT: 8,
  SEQ_MASK: 0xffffff00,
  /** Extended flags: bits 0-7 */
  FLAGS_EXT_MASK: 0x000000ff
} as const

// =============================================================================
// Node Flags
// =============================================================================

/**
 * Node flags (lower 8 bits of PACKED_A).
 *
 * NOTE: Node liveness tracking is handled by LAST_PASS_ID (generation-based),
 * not by flag bits. Do not add a TOUCHED flag.
 */
export const FLAG = {
  /** Node is active (not deleted) */
  ACTIVE: 0x01,
  /** Node is muted (skip during playback) */
  MUTED: 0x02,
  /** Write in progress (consumer should spin/skip) */
  DIRTY: 0x04,
  /** [RFC-047] Packed Expression ID (4 bits: 0-15) */
  EXPRESSION_SHIFT: 4,
  EXPRESSION_MASK: 0xF0
} as const

// =============================================================================
// Opcodes
// =============================================================================

/**
 * Node opcodes (upper 8 bits of PACKED_A).
 */
export const OPCODE = {
  /** Note event */
  NOTE: 0x01,
  /** Rest (silent duration) */
  REST: 0x02,
  /** Control change */
  CC: 0x03,
  /** Pitch bend */
  BEND: 0x04,
  /** Phase Barrier (wait until cycle boundary) */
  BARRIER: 0x05
} as const

// =============================================================================
// Commit Protocol
// =============================================================================

/**
 * COMMIT_FLAG states for structural edit synchronization.
 */
export const COMMIT = {
  /** No pending structural changes */
  IDLE: 0,
  /** Structural change complete, awaiting ACK */
  PENDING: 1,
  /** Consumer acknowledged, Linker can clear */
  ACK: 2
} as const

// =============================================================================
// Debug Flags (Task 077)
// =============================================================================

/**
 * DEBUG_FLAGS bit masks for runtime debug mode.
 *
 * Stored in HDR.DEBUG_FLAGS as a numeric bitmask. Read with
 * `Atomics.load(sab, HDR.DEBUG_FLAGS) & DEBUG.ENABLED` — O(1) integer
 * comparison, zero allocation, available in any context (main thread,
 * Worker, AudioWorklet), and directly translatable to Rust.
 *
 * Set once at init time via `createLinkerSAB({ debug: true })`.
 */
export const DEBUG = {
  /** Bit 0: debug mode on/off */
  ENABLED: 1
} as const

// =============================================================================
// Error Codes
// =============================================================================

/**
 * ERROR_FLAG bitmask values.
 * Multiple bits may be set simultaneously.
 */
export const ERROR = {
  /** No error */
  OK: 0,
  /** Heap exhausted (no free nodes) */
  HEAP_EXHAUSTED: 1 << 0,
  /** Safe zone violation (edit too close to playhead) */
  SAFE_ZONE: 1 << 1,
  /** Invalid pointer encountered */
  INVALID_PTR: 1 << 2,
  /** [v1.5] Kernel panic: mutex deadlock or catastrophic failure */
  KERNEL_PANIC: 1 << 3,
  /** [v1.5] Identity Table load factor exceeded 75% warning */
  LOAD_FACTOR_WARNING: 1 << 4,
  /** [RFC-045-04] Free list corruption detected */
  FREE_LIST_CORRUPT: 1 << 5,
  /** [RFC-045-04] Unknown command opcode received */
  UNKNOWN_OPCODE: 1 << 6,
  /** [RFC-059] Ring buffer full after spin timeout */
  RING_FULL: 1 << 7,
  /** [RFC-059] SPSC invariant violation (cross-context alloc/free) */
  SPSC_VIOLATION: 1 << 8,
  /** [RFC-059] Reclaim ring overflow (producer outpaced consumer) */
  RECLAIM_OVERFLOW: 1 << 9,
  /** [RFC-059] CAS retry budget exhausted */
  CAS_EXHAUSTION: 1 << 10,
  /** [RFC-058] Invalid synapse capacity (must be power of 2) */
  INVALID_SYNAPSE_CAPACITY: 1 << 11,
  /** [RFC-058] Invalid worker zones (must be 1-8) */
  INVALID_WORKER_ZONES: 1 << 12
} as const

// =============================================================================
// Identity Table (v1.5) - TID → NodePtr Hash Map
// =============================================================================

/**
 * Identity Table constants for O(1) Temporal ID lookups.
 *
 * The Identity Table is a fixed-size hash table stored in the SAB that maps
 * Temporal IDs (TID) to NodePtr values for zero-allocation lookups.
 *
 * Structure: Triangular-number probe hash table with [TID: i32, NodePtr: u32] entries.
 * Uses slot += step; step++ (guarantees full coverage for power-of-2 capacity).
 * - TID = 0: Empty slot
 * - TID = -1: Tombstone (deleted entry)
 * - TID > 0: Active entry
 */
export const ID_TABLE = {
  /** Entry size in i32 units (TID + NodePtr) */
  ENTRY_SIZE_I32: 2,
  /** Entry size in bytes */
  ENTRY_SIZE_BYTES: 8,
  /** Default capacity (4096 entries = 32KB) */
  DEFAULT_CAPACITY: 4096,
  /** Load factor threshold for warnings (0.75 = 75%) */
  LOAD_FACTOR_WARNING: 0.75,
  /** Empty slot marker */
  EMPTY_TID: 0,
  /** Tombstone marker (deleted entry) */
  TOMBSTONE_TID: -1
} as const

// =============================================================================
// Symbol Table (v1.5) - SourceId → Packed SourceLocation
// =============================================================================

/**
 * Symbol Table constants for storing packed SourceLocations in SAB.
 *
 * The Symbol Table is a parallel structure to the Identity Table that maps
 * sourceId → packed SourceLocation for editor integration (click-to-source).
 *
 * Packed SourceLocation format (64 bits / 2 × i32):
 * - [0] FILE_HASH: Hash of the file path (i32)
 * - [1] LINE_COL: (line << 16) | (column & 0xFFFF) (i32)
 *
 * This allows zero-allocation storage/retrieval of source locations.
 */
export const SYM_TABLE = {
  /** Entry size in i32 units (fileHash + lineCol) */
  ENTRY_SIZE_I32: 2,
  /** Entry size in bytes */
  ENTRY_SIZE_BYTES: 8,
  /** Empty entry marker (fileHash = 0 indicates no location) */
  EMPTY_ENTRY: 0,
  /** Line shift for packing into lineCol field */
  LINE_SHIFT: 16,
  /** Column mask for extracting from lineCol field */
  COLUMN_MASK: 0xffff,
  /** Maximum line number (16 bits = 65535) */
  MAX_LINE: 0xffff,
  /** Maximum column number (16 bits = 65535) */
  MAX_COLUMN: 0xffff
} as const

// =============================================================================
// Concurrency Control (v1.5)
// =============================================================================

/**
 * Concurrency control constants for lock-free and mutex-based operations.
 */
export const CONCURRENCY = {
  /** Chain Mutex: Unlocked state */
  MUTEX_UNLOCKED: 0,
  /** Chain Mutex: Locked state */
  MUTEX_LOCKED: 1,
  /** CPU yield threshold: yield after this many spins */
  YIELD_AFTER_SPINS: 100,
  /** Dead-Man's Switch: panic after this many mutex acquisition attempts (~200ms with 1ms yields) */
  MUTEX_PANIC_THRESHOLD: 200,
  /** [RFC-045-04] Maximum spins for audio-safe try-lock (~300ns, sub-microsecond) */
  AUDIO_SAFE_MAX_SPINS: 3,
  /** [RFC-059] Maximum CAS retries for attribute patching before failure */
  CAS_MAX_RETRIES: 64
} as const

// =============================================================================
// Source ID Range (RFC-045-04)
// =============================================================================

/**
 * Source ID range constants for positive Int32 enforcement.
 *
 * SourceIds must fit in the positive Int32 range (1 to 2^31-1).
 * After 2,147,483,647 IDs, the counter wraps around to MIN.
 */
export const SOURCE_ID = {
  /** Minimum valid source ID (0 is reserved for NULL) */
  MIN: 1,
  /** Maximum valid source ID (Int32 positive range) */
  MAX: 0x7FFFFFFF,
  /** Wraparound point: restart from MIN when MAX is exceeded */
  WRAP_THRESHOLD: 0x7FFFFFFF
} as const

// =============================================================================
// Command Ring Buffer (RFC-044)
// =============================================================================

/**
 * Command Ring Buffer constants for zero-blocking structural edits.
 *
 * The Command Ring is a fixed-stride circular buffer that queues structural
 * operations (INSERT, DELETE, PATCH, CLEAR) from the Main Thread to the Worker.
 *
 * Each command occupies exactly 4 × i32 (16 bytes) for alignment:
 * [OPCODE, PARAM_1, PARAM_2, RESERVED]
 *
 * Task 060: Increased from 64KB to 1MB (65536 entries) for burst composition safety.
 */
export const COMMAND = {
  /** Command stride in bytes (16 bytes for 4 × i32) */
  STRIDE_BYTES: 16,
  /** Command stride in i32 units (4 words) */
  STRIDE_I32: 4,
  /** Default ring buffer size in bytes (1MB = 65536 commands, Task 060) */
  DEFAULT_RING_SIZE_BYTES: 1048576
} as const

// =============================================================================
// Reclaim Ring Buffer (K-005)
// =============================================================================

/**
 * Reclaim Ring Buffer constants (Main Thread -> Worker).
 * Queue for recycling Zone B nodes.
 */
export const RECLAIM = {
  /** Reclaim Ring stride in bytes (4 bytes for 1ptr) */
  STRIDE_BYTES: 4,
  /** Reclaim Ring stride in i32 units (1 word) */
  STRIDE_I32: 1,
  /** Default ring buffer size in bytes (16KB = 4096 ptrs) */
  DEFAULT_RING_SIZE_BYTES: 16384
} as const

// =============================================================================
// Synapse Table (RFC-045) - The Neural Connection Graph
// =============================================================================

/**
 * Synapse Table constants for the "Silicon Brain" Neural Audio Processor.
 *
 * The Synapse Table is a 1.25MB linear-probe hash table that connects musical
 * "Axons" (Clips) via probabilistic "Synapses" (Connections). This enables
 * non-linear, generative music where clips trigger each other based on weights,
 * jitter, and plasticity.
 *
 * Each Synapse occupies exactly 20 bytes (5 × i32) with tightly packed fields:
 * - SOURCE_PTR: The trigger node (end of clip) - used as hash key
 * - TARGET_PTR: The destination node (start of next clip)
 * - WEIGHT_DATA: Packed [Weight (16b) | Jitter (16b)]
 * - META_NEXT: Packed [Plasticity Flags (8b) | Next Synapse Ptr (24b)]
 * - NEXT_SAME_TARGET: Slot index for reverse index linked list (synapses TO same target)
 */
export const SYNAPSE_TABLE = {
  /** Synapse Table size in bytes (~1.25MB for 65536 × 20 bytes) */
  SIZE_BYTES: 1310720,
  /** Maximum number of synapses */
  MAX_CAPACITY: 65536,
  /** Synapse stride in bytes (20 bytes for 5 × i32) */
  STRIDE_BYTES: 20,
  /** Synapse stride in i32 units (5 words) */
  STRIDE_I32: 5,
  /** Trigger compaction when tombstones exceed this ratio (ISSUE-021) */
  COMPACTION_THRESHOLD: 0.5,
  /** Minimum slots before compaction is worthwhile (ISSUE-021) */
  COMPACTION_MIN_SLOTS: 100
} as const

/**
 * Synapse structure offsets (5 × i32 = 20 bytes per synapse).
 *
 * The Synapse struct represents a connection between two Axons (clips) in the
 * neural topology. It is tightly packed for cache efficiency and atomic operations.
 *
 * Layout:
 * - [+0] SOURCE_PTR: Byte offset to trigger node (hash key for lookup)
 * - [+1] TARGET_PTR: Byte offset to destination node
 * - [+2] WEIGHT_DATA: Packed (weight << 0) | (jitter << 16)
 * - [+3] META_NEXT: Packed (plasticity << 0) | (nextSynapse << 8)
 * - [+4] NEXT_SAME_TARGET: Slot index for reverse index linked list (-1 = end)
 */
export const SYNAPSE = {
  /** Source node pointer (trigger point, used as hash key) */
  SOURCE_PTR: 0,
  /** Target node pointer (destination for signal propagation) */
  TARGET_PTR: 1,
  /** Packed weight (0-1000) and jitter (0-65535) data */
  WEIGHT_DATA: 2,
  /** Packed plasticity flags (8 bits) and next synapse pointer (24 bits) for SOURCE chain */
  META_NEXT: 3,
  /** Slot index of next synapse with same TARGET (reverse index), -1 = end of list */
  NEXT_SAME_TARGET: 4
} as const

/**
 * Synapse packing constants for atomic bit manipulation.
 *
 * These constants enable efficient packing/unpacking of multiple fields into
 * single 32-bit integers for cache-aligned, atomic operations.
 *
 * WEIGHT_DATA packing (i32 at offset 2):
 * - Bits 0-15:  Weight (0-1000 fixed-point probability/intensity)
 * - Bits 16-31: Jitter (0-65535 micro-timing deviation in ticks)
 *
 * META_NEXT packing (i32 at offset 3):
 * - Bits 0-7:   Plasticity flags (learning/potentiation state)
 * - Bits 8-31:  Next synapse pointer (24-bit collision chain index)
 */
export const SYN_PACK = {
  // WEIGHT_DATA field (offset 2)
  /** Weight field: bits 0-15 (0-1000 fixed-point, 0.0 to 1.0) */
  WEIGHT_MASK: 0xffff,
  WEIGHT_SHIFT: 0,
  /** Jitter field: bits 16-31 (0-65535 ticks micro-timing deviation) */
  JITTER_MASK: 0xffff,
  JITTER_SHIFT: 16,

  // META_NEXT field (offset 3)
  /** Plasticity flags: bits 0-7 (learning state, potentiation markers) */
  PLASTICITY_MASK: 0xff,
  PLASTICITY_SHIFT: 0,
  /** Next synapse pointer: bits 8-31 (24-bit index for collision chain) */
  NEXT_PTR_MASK: 0xffffff,
  NEXT_PTR_SHIFT: 8
} as const

/**
 * Synapse execution safety quotas to prevent infinite loops in Audio Thread.
 *
 * The Kernel tracks how many synapses have fired in the current audio block.
 * If this quota is exceeded, synaptic resolution aborts to guarantee real-time
 * performance (prevents runaway feedback loops or recursive synapse chains).
 */
export const SYNAPSE_QUOTA = {
  /** Maximum synapses that can fire per audio block (default: 64) */
  MAX_FIRES_PER_BLOCK: 64
} as const

/**
 * Reverse Index constants for O(k) disconnectAllToTarget() (RFC-045-04 ISSUE-016).
 *
 * The Reverse Index is a hash table that maps TARGET_PTR → linked list of synapses.
 * This enables O(k) disconnect operations where k = number of synapses pointing
 * to a target, instead of O(65536) full table scan.
 *
 * Memory Layout:
 * - 256 buckets × 4 bytes = 1KB total
 * - Each bucket stores the head slot index of a linked list
 * - Synapses in the same bucket are chained via NEXT_SAME_TARGET field
 */
export const REVERSE_INDEX = {
  /** Number of hash buckets (power of 2 for fast modulo) */
  BUCKET_COUNT: 256,
  /** Bitmask for bucket index calculation (BUCKET_COUNT - 1) */
  BUCKET_MASK: 255,
  /** Stride per bucket in i32 units (1 word = slot index) */
  STRIDE_I32: 1,
  /** Sentinel value for empty bucket or end of list */
  EMPTY: -1
} as const

/**
 * Calculate the byte offset to the Reverse Index table in the SAB.
 *
 * Layout: [Header][Nodes][IdTable][SymTable][RingBuffer][SynapseTable][ReverseIndex]
 *
 * K-002: Now accepts optional synapseCapacity for dynamic synapse table sizing.
 *
 * @param nodeCapacity - Number of nodes in the SAB
 * @param synapseCapacity - Maximum number of synapses (K-002 dynamic, defaults to nodeCapacity * 8)
 * @returns Byte offset to the start of the Reverse Index table
 */
export function getReverseIndexOffset(nodeCapacity: number, synapseCapacity?: number): number {
  const effectiveSynapseCapacity = synapseCapacity ?? nodeCapacity * 8
  const synapseTableSize = effectiveSynapseCapacity * SYNAPSE_TABLE.STRIDE_BYTES
  const synapseTableEnd = getSynapseTableOffset(nodeCapacity) + synapseTableSize
  return synapseTableEnd
}

// =============================================================================
// Multi-Zone Configuration (RFC-056)
// =============================================================================

/**
 * Per-zone configuration structure (RFC-056).
 *
 * Each worker zone has its own configuration block in the Zone Config Table.
 * The table starts at HDR.ZONE_CONFIG_OFFSET and contains ZONE_COUNT entries.
 *
 * Layout: 10 × i32 = 40 bytes per zone
 * - HEAP_START: First node byte offset in this zone
 * - HEAP_END: Last node byte offset + 1 (exclusive)
 * - FREE_LIST_HEAD: Current free list head (32-bit, SPSC)
 * - FREE_COUNT: Free nodes in this zone
 * - NODE_COUNT: Allocated nodes in this zone
 * - NODE_CAPACITY: Total capacity of this zone
 * - OWNER_ID: Worker ID that owns this zone (0 = unclaimed)
 * - RESERVED: Reserved for future use (alignment)
 * - RETURN_QUEUE_HEAD: [ATOMIC] MPSC Return Queue head (producers CAS here)
 * - RETURN_QUEUE_TAIL: Return Queue tail (only owner reads/advances)
 */
export const ZONE_CONFIG = {
  /** First node byte offset in this zone */
  HEAP_START: 0,
  /** Last node byte offset + 1 (exclusive) */
  HEAP_END: 1,
  /** Current free list head (32-bit, SPSC) */
  FREE_LIST_HEAD: 2,
  /** Free nodes in this zone */
  FREE_COUNT: 3,
  /** Allocated nodes in this zone */
  NODE_COUNT: 4,
  /** Total capacity of this zone */
  NODE_CAPACITY: 5,
  /** Worker ID that owns this zone (0 = unclaimed) */
  OWNER_ID: 6,
  /** Reserved for future use (alignment) */
  RESERVED: 7,
  /** [ATOMIC] MPSC Return Queue head (producers CAS here) */
  RETURN_QUEUE_HEAD: 8,
  /** Return Queue tail (only owner reads/advances) */
  RETURN_QUEUE_TAIL: 9
} as const

/**
 * Number of i32 slots per zone configuration entry.
 * 10 slots × 4 bytes = 40 bytes per zone.
 */
export const ZONE_CONFIG_STRIDE = 10

/**
 * Fixed capacity of each zone's Return Queue (number of pointer slots).
 * 256 slots × 4 bytes = 1KB per queue.
 */
export const RETURN_QUEUE_CAPACITY = 256

/**
 * Calculate the byte offset to the Zone Configuration Table.
 * The table is placed after all existing structures (at the end of the SAB).
 *
 * @param nodeCapacity - Maximum number of nodes
 * @param synapseCapacity - Maximum number of synapses (default: nodeCapacity * 8)
 * @returns Byte offset to Zone Config Table
 */
export function getZoneConfigTableOffset(nodeCapacity: number, synapseCapacity?: number): number {
  const effectiveSynapseCapacity = synapseCapacity ?? nodeCapacity * 8
  
  // Calculate offset after all existing structures
  const headerSize = HEAP_START_OFFSET
  const heapSize = nodeCapacity * NODE_SIZE_BYTES
  const identityTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
  const symbolTableSize = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES
  const grooveSize = 1024
  const ringBufferSize = COMMAND.DEFAULT_RING_SIZE_BYTES
  const reclaimRingSize = RECLAIM.DEFAULT_RING_SIZE_BYTES
  const synapseTableSize = effectiveSynapseCapacity * SYNAPSE_TABLE.STRIDE_BYTES
  const reverseIndexSize = REVERSE_INDEX.BUCKET_COUNT * 4
  
  return headerSize + heapSize + identityTableSize + symbolTableSize + grooveSize +
         ringBufferSize + reclaimRingSize + synapseTableSize + reverseIndexSize
}

/**
 * Calculate the byte offset to the Return Queue buffers region.
 * Return Queue buffers start immediately after the Zone Config Table.
 *
 * @param zoneConfigOffset - Byte offset to Zone Config Table (from HDR.ZONE_CONFIG_OFFSET)
 * @param workerZones - Number of worker zones
 * @returns Byte offset to Return Queue buffers
 */
export function getReturnQueueBufferOffset(zoneConfigOffset: number, workerZones: number): number {
  const zoneConfigTableSize = ZONE_CONFIG_STRIDE * workerZones * 4 // bytes
  return zoneConfigOffset + zoneConfigTableSize
}

/**
 * Calculate the byte offset to a specific zone's Return Queue buffer.
 *
 * @param zoneConfigOffset - Byte offset to Zone Config Table (from HDR.ZONE_CONFIG_OFFSET)
 * @param workerZones - Number of worker zones
 * @param zoneIndex - Index of the zone (0-based)
 * @returns Byte offset to the zone's Return Queue buffer
 */
export function getReturnQueueForZone(zoneConfigOffset: number, workerZones: number, zoneIndex: number): number {
  const baseOffset = getReturnQueueBufferOffset(zoneConfigOffset, workerZones)
  return baseOffset + zoneIndex * RETURN_QUEUE_CAPACITY * 4 // 4 bytes per slot
}

/**
 * Zone error codes (RFC-056 zero-allocation error handling).
 */
export const ZONE_ERR = {
  /** Operation succeeded */
  OK: 0,
  /** No zones available for claiming */
  NO_ZONES_AVAILABLE: -1,
  /** Zone exhausted (no free nodes) */
  ZONE_EXHAUSTED: -2,
  /** Return Queue full */
  RETURN_QUEUE_FULL: -3
} as const

// =============================================================================
// Zero-Allocation Error Codes (RFC-045-04)
// =============================================================================

/**
 * SiliconBridge error codes (zero-allocation error handling).
 * Methods return these instead of throwing exceptions.
 */
export const BRIDGE_ERR = {
  /** Operation succeeded */
  OK: 0,
  /** Source/target ID not found in Identity Table */
  NOT_FOUND: -1,
  /** Synapse Table full */
  TABLE_FULL: -2,
  /** Invalid pointer */
  INVALID_PTR: -3,
  /** [Task 075] Ring buffer full after spin timeout */
  RING_FULL: -4
} as const

/**
 * SynapseAllocator error codes (zero-allocation error handling).
 * connect() returns these instead of throwing exceptions.
 */
export const SYNAPSE_ERR = {
  /** Operation succeeded (positive value is SynapsePtr) */
  OK: 0,
  /** Invalid source or target pointer */
  INVALID_PTR: -1,
  /** Synapse Table full */
  TABLE_FULL: -2,
  /** Infinite loop detected in chain traversal */
  CHAIN_LOOP: -3
} as const

/**
 * LocalAllocator error codes (zero-allocation error handling).
 * alloc() returns these instead of throwing exceptions.
 */
export const ALLOC_ERR = {
  /** Zone B heap exhausted */
  EXHAUSTED: -1
} as const

/**
 * validateLinkerSAB error codes (Task 079).
 * Returns 0 on success, negative on failure.
 */
export const VALIDATE_ERR = {
  /** SAB is valid */
  OK: 0,
  /** Buffer too small to contain header */
  TOO_SMALL: -1,
  /** Magic number mismatch */
  BAD_MAGIC: -2,
  /** Version mismatch */
  BAD_VERSION: -3,
  /** NODE_CAPACITY is non-positive or unreasonably large */
  BAD_NODE_CAPACITY: -4,
  /** SYNAPSE_CAPACITY is non-positive or not a power of 2 */
  BAD_SYNAPSE_CAPACITY: -5,
  /** ZONE_COUNT out of valid range (1-8) */
  BAD_ZONE_COUNT: -6,
  /** Buffer byteLength doesn't match calculated size from header values */
  SIZE_MISMATCH: -7,
  /** HEAP_START doesn't match expected offset */
  BAD_HEAP_START: -8
} as const

/**
 * Default number of commands that can be queued (1MB / 16 bytes, Task 060).
 */
export const DEFAULT_RING_CAPACITY = COMMAND.DEFAULT_RING_SIZE_BYTES / COMMAND.STRIDE_BYTES

/**
 * Command opcodes for Ring Buffer protocol (RFC-044).
 *
 * These opcodes are written to the Command Ring Buffer by the Main Thread
 * and processed by the Worker Thread to perform deferred structural operations.
 *
 * **Protocol:**
 * - Main Thread: Allocates node in Zone B, writes data, enqueues command
 * - Worker Thread: Dequeues command, links node into chain, updates Identity Table
 *
 * Each command has the format: [OPCODE, PARAM_1, PARAM_2, RESERVED]
 */
export const CMD = {
  /** Insert a floating node into the chain at a specific position */
  INSERT: 1,
  /** Delete a node from the chain (returns to Zone A free list) */
  DELETE: 2,
  /** Patch node attributes atomically (deferred/batched updates) */
  PATCH: 3,
  /** Clear all nodes from the chain (mass delete) */
  CLEAR: 4,
  /** [RFC-054] Create synapse connection using raw pointers (async-safe) */
  CONNECT: 5,
  /** [RFC-054] Remove synapse connection using raw pointers (async-safe) */
  DISCONNECT: 6
} as const

/**
 * Calculate the Zone Split Index for partitioned heap allocation (RFC-044).
 *
 * The node heap is partitioned into two zones to eliminate allocation contention:
 * - **Zone A (Kernel)**: Indices 0 to ZONE_SPLIT_INDEX - 1 (Worker/Audio Thread)
 * - **Zone B (UI)**: Indices ZONE_SPLIT_INDEX to nodeCapacity - 1 (Main Thread)
 *
 * This allows lock-free allocation: Worker uses CAS-based free list in Zone A,
 * Main Thread uses bump allocator in Zone B.
 *
 * @param nodeCapacity - Maximum number of nodes
 * @returns Index where Zone B begins (typically nodeCapacity / 2)
 */
export function getZoneSplitIndex(nodeCapacity: number): number {
  return Math.floor(nodeCapacity / 2)
}

// =============================================================================
// Memory Layout Calculation
// =============================================================================

/**
 * Calculate total SAB size needed for given node capacity.
 *
 * Layout:
 * - Header + Registers + Command Ring + Reclaim Ring + Synapse Header + Multi-Zone + Synapse Counters: 184 bytes (46 × i32)
 * - Node Heap: nodeCapacity × 32 bytes
 * - Identity Table: nodeCapacity × 2 × 8 bytes (RFC-047-50: 2x capacity for load factor)
 * - Symbol Table: nodeCapacity × 8 bytes (fileHash + lineCol per entry)
 * - Groove Templates: 1024 bytes (fixed)
 * - Command Ring Buffer: 1MB (Task 060)
 * - Reclaim Ring Buffer: 16KB (K-005)
 * - Synapse Table: synapseCapacity × 20 bytes (K-002: dynamic sizing)
 * - Reverse Index: 1KB (ISSUE-016)
 * - Zone Config Table: workerZones × 40 bytes (RFC-056, only when workerZones > 1)
 * - Return Queue Buffers: workerZones × 1KB (RFC-056, only when workerZones > 1)
 *
 * @param nodeCapacity - Maximum number of nodes
 * @param synapseCapacity - Maximum number of synapses (default: nodeCapacity * 8)
 * @param workerZones - Number of worker zones (default: 1, legacy mode)
 * @returns Total bytes needed for SharedArrayBuffer
 */
export function calculateSABSize(nodeCapacity: number, synapseCapacity?: number, workerZones?: number): number {
  const effectiveSynapseCapacity = synapseCapacity ?? nodeCapacity * 8
  const effectiveWorkerZones = workerZones ?? 1
  
  // Existing regions
  const headerSize = HEAP_START_OFFSET // 184 bytes (RFC-059 R-007)
  const heapSize = nodeCapacity * NODE_SIZE_BYTES
  const identityTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES // RFC-047-50: 2x capacity
  const symbolTableSize = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES // Must match Identity Table capacity
  const grooveSize = 1024 // Fixed groove template region
  const ringBufferSize = COMMAND.DEFAULT_RING_SIZE_BYTES // 1MB command ring (Task 060)
  const reclaimRingSize = RECLAIM.DEFAULT_RING_SIZE_BYTES // 16KB reclaim ring (K-005)
  const synapseTableSize = effectiveSynapseCapacity * SYNAPSE_TABLE.STRIDE_BYTES // K-002: dynamic
  const reverseIndexSize = REVERSE_INDEX.BUCKET_COUNT * 4 // 1KB reverse index (ISSUE-016)
  
  // RFC-056: Multi-zone regions (only when workerZones > 1)
  const zoneConfigTableSize = effectiveWorkerZones > 1
    ? ZONE_CONFIG_STRIDE * effectiveWorkerZones * 4 // 40 bytes per zone
    : 0
  const returnQueueBuffersSize = effectiveWorkerZones > 1
    ? RETURN_QUEUE_CAPACITY * effectiveWorkerZones * 4 // 1KB per zone (256 slots × 4 bytes)
    : 0
  
  return headerSize + heapSize + identityTableSize + symbolTableSize + grooveSize + 
         ringBufferSize + reclaimRingSize + synapseTableSize + reverseIndexSize +
         zoneConfigTableSize + returnQueueBuffersSize
}

/**
 * Byte offset where node heap begins.
 *
 * Memory layout (i32 indices):
 * - Base Header (0-15): 16 × 4 = 64 bytes
 * - Register Bank (16-22): 7 × 4 = 28 bytes
 * - Extended Header (23-31): 9 × 4 = 36 bytes
 * - Command Ring Header (32-35): 4 × 4 = 16 bytes
 * - Reclaim Ring Header (36-39): 4 × 4 = 16 bytes
 * - Synapse Header (40-41): 2 × 4 = 8 bytes
 * - Multi-Zone Header (42-43): 2 × 4 = 8 bytes (RFC-056)
 * - Synapse Counter Header (44-45): 2 × 4 = 8 bytes (RFC-059 R-007)
 *
 * Total: 64 + 28 + 36 + 16 + 16 + 8 + 8 + 8 = 184 bytes (indices 0-45)
 */
export const HEAP_START_OFFSET = 184

/**
 * Calculate i32 index where node heap begins.
 */
export const HEAP_START_I32 = HEAP_START_OFFSET / 4

/**
 * Calculate byte offset where Identity Table begins.
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Identity Table
 */
export function getIdentityTableOffset(nodeCapacity: number): number {
  return HEAP_START_OFFSET + nodeCapacity * NODE_SIZE_BYTES
}

/**
 * Calculate byte offset where Symbol Table begins.
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Symbol Table
 */
export function getSymbolTableOffset(nodeCapacity: number): number {
  // RFC-047-50: Identity Table uses 2x capacity for load factor
  // Symbol Table must account for full Identity Table size
  return getIdentityTableOffset(nodeCapacity) + nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
}

/**
 * Calculate byte offset where Groove Templates begin.
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Groove Templates
 */
export function getGrooveTemplateOffset(nodeCapacity: number): number {
  // Must match Symbol Table capacity (nodeCapacity * 2)
  return getSymbolTableOffset(nodeCapacity) + nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES
}

/**
 * Calculate byte offset where Command Ring Buffer data begins (RFC-044).
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Command Ring Buffer data region
 */
export function getRingBufferOffset(nodeCapacity: number): number {
  return getGrooveTemplateOffset(nodeCapacity) + 1024 // Groove size is fixed at 1024 bytes
}

/**
 * Calculate byte offset where Reclaim Ring Buffer data begins (K-005).
 * Immediately follows Command Ring.
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Reclaim Ring Buffer data region
 */
export function getReclaimRingOffset(nodeCapacity: number): number {
  return getRingBufferOffset(nodeCapacity) + COMMAND.DEFAULT_RING_SIZE_BYTES
}

/**
 * Calculate byte offset where Synapse Table begins (RFC-045).
 *
 * The Synapse Table is a 1MB linear-probe hash table that stores neural
 * connections between Axons (clips). It resides immediately after the
 * Reclaim Ring Buffer in the SharedArrayBuffer.
 *
 * @param nodeCapacity - Maximum number of nodes
 * @returns Byte offset to Synapse Table
 */
export function getSynapseTableOffset(nodeCapacity: number): number {
  return getReclaimRingOffset(nodeCapacity) + RECLAIM.DEFAULT_RING_SIZE_BYTES
}

// =============================================================================
// Type Exports
// =============================================================================

export type Opcode = (typeof OPCODE)[keyof typeof OPCODE]
export type CommitState = (typeof COMMIT)[keyof typeof COMMIT]
export type ErrorCode = (typeof ERROR)[keyof typeof ERROR]
export type NodeFlag = (typeof FLAG)[keyof typeof FLAG]
