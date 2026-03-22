# RFC-050: Synaptic Modulation Architecture 2.0

**Status:** Draft  
**Authors:** SymphonyScript Core Team  
**Date:** 2026-03-14  
**Supersedes:** RFC-050-synapsis-vision-initial.md (Section 4 — Animation/Modulation)  
**Depends on:** RFC-043 (Silicon Linker), RFC-044 (Command Ring), RFC-045 (Synapse Table), RFC-054 (Phase Barriers)

---

## 1. Abstract

This RFC specifies the complete modulation architecture for SymphonyScript: the system that allows external parameters (game state, sensor input, MIDI controllers, live-coding knobs) to dynamically influence musical properties (velocity, pitch, tempo, filter cutoff) at audio-block rate.

The design introduces three new SharedArrayBuffer (SAB) regions — `PARAMETER_TABLE`, `MODULATION_TABLE`, and `LUT_POOL` — and expands the existing `NODE` struct from 32 bytes to 64 bytes. All modulation state is stored in typed arrays using Q16.16 fixed-point integers. No objects, closures, or strings are used at audio time.

The architecture maintains SymphonyScript's core invariants:
- **Zero allocation** in hot paths
- **All state in typed arrays** — Rust-portable without GC
- **SPSC ownership** — Bridge writes, audio thread reads
- **Lock-free parameter updates** — `Atomics.store` for value changes
- **Ring-buffered structural mutations** — linked-list operations via `CMD.CREATE_MOD` / `CMD.DELETE_MOD`

---

## 2. Motivation

### 2.1 Problem Statement

RFC-050 (initial vision) defines the *concept* of modulation — animations that shape synaptic weights and note properties based on parameters — but leaves the implementation critically underspecified:

1. **No serialization format.** The RFC mentions "Bytecode or Lookup Table" without specifying either.
2. **No memory layout.** `PARAMETER_TABLE` is referenced but never defined.
3. **String parameter names** in examples (`'Intensity'`) conflict with the numeric-ID constraint.
4. **No evaluation strategy.** When and how animations are applied at runtime is undefined.
5. **No clamping semantics.** The "0.0–1.0+" multiplier range is ambiguous for integer math.
6. **No envelope integration.** Polyphonic persistence requires coordination between kernel and DSP, but the mechanism is unspecified.

### 2.2 Solution Overview

This RFC resolves all six gaps by defining:
- A **three-table SAB architecture** for parameters, modulators, and pre-computed curves
- A **dual-layer smoothing system** with per-parameter and per-modulator control
- A **hybrid evaluation strategy** — batch parameters per block, lazy modulators per voice
- An **additive delta combination model** for multi-modulator stacking
- A **Composition API** with typed modulator factories and inline cursors
- A **clear DSP/Kernel boundary** — the kernel manages Time and Modulation, the DSP manages Amplitude and Synthesis

---

## 3. Architecture Overview

### 3.1 The Score vs. Performer Paradigm

The architecture enforces a strict separation of concerns:

**The SAB (Score)** manages:
- Time — ticks, playhead position
- Composition — nodes, note data
- Routing — synapses, weights
- Modulation — parameters, modulators, curves

**The DSP Layer (Performer)** manages:
- Synthesis — oscillators, filters
- Voice allocation — polyphony, voice stealing
- Amplitude envelopes — ADSR, release tails
- Silence detection — `isNearSilent()` cleanup

**Communication is one-way.** The kernel fires `noteOn`/`noteOff` → DSP. The DSP never writes back to the SAB. Voice lifetime is managed entirely within `BasicVoice` — the kernel has no concept of "Voice N."

### 3.2 Concurrency Model

| Writer | Reader | Mechanism |
|:---|:---|:---|
| Bridge → `PARAMETER_TABLE.RAW_VALUE` | Audio engine | `Atomics.store` (SPSC, lock-free) |
| Bridge → Modulator config fields | Audio engine | `Atomics.store` (SPSC, lock-free) |
| Bridge → `LUT_POOL` data | Audio engine | `Atomics.store` (bulk write before link) |
| Bridge → `MOD_LIST_HEAD` chain | Audio engine | `CMD.CREATE_MOD` / `CMD.DELETE_MOD` via Ring Buffer |
| Audio engine → `PARAMETER_TABLE.SMOOTHED_VALUE` | DSP voices | Single-writer (audio engine only) |

### 3.3 Signal Chain

```
┌──────────────────────────────────────────────────────────────────────┐
│ PARAMETER_TABLE (per block, batch-active)                            │
│                                                                      │
│  RAW_VALUE ──→ [Spatial Curve] ──→ CURVED_VALUE ──→ [Smooth] ──→ SMOOTHED_VALUE
│                                                                      │
│  Bridge writes ↑                   Audio engine owns ↑    ↑    ↑     │
└──────────────────────────────────────────────────────────────────────┘
                                                          │
                                          TapSource selects which value
                                         (SMOOTHED / CURVED / RAW)
                                                          │
┌──────────────────────────────────────────────────────────────────────┐
│ MODULATION_TABLE (per voice, lazy evaluation)                        │
│                                                                      │
│  ParamValue ──→ [Modulator Curve / LUT] ──→ [Mod Smooth] ──→ Delta  │
│                                                                      │
│  Delta = Amount × CurvedInput                                        │
└──────────────────────────────────────────────────────────────────────┘
                                                          │
                              Effective = NodeBase + Σ(Deltaᵢ)  →  [Clamp]
```

---

## 4. Fixed-Point Mathematics

### 4.1 Standard

All modulation values use **Q16.16 fixed-point** representation in `Int32` slots:

```
1.0  = 65536  (0x00010000)
0.5  = 32768  (0x00008000)
0.0  = 0
-1.0 = -65536
```

### 4.2 Rationale

JavaScript `Atomics.load()` and `Atomics.store()` do not support `Float32Array`. Using `Int32` with fixed-point avoids float rounding in the critical path and maps directly to Rust integer math with no GC dependency.

### 4.3 Conversion

```typescript
// Main thread (Bridge) — float to fixed-point
function toFixed16(value: number): number {
  return (value * 65536) | 0;
}

// Audio thread (Engine) — fixed-point to float (for DSP handoff)
function fromFixed16(fixed: number): number {
  return fixed / 65536;
}
```

### 4.4 Clamping

Clamping is **per-target-property**, controlled by the `CLAMP_0_1` bit in the modulator's `PACKED_CFG_A`:

| Target Property | Clamp Behavior | Range |
|:---|:---|:---|
| Velocity | Clamped | `[0, 65536]` (0.0–1.0) |
| Volume | Clamped | `[0, 65536]` (0.0–1.0) |
| Pitch | Unclamped | Full `Int32` range |
| Filter Cutoff | Unclamped | Full `Int32` range |
| Tempo | Clamped (floor) | `[1310720, ∞)` (20+ BPM) |

Clamping is applied once, at the end of the additive delta chain:

```
Effective = clamp(NodeBase + Σ(Deltaᵢ), min, max)  // if CLAMP_0_1 bit set
Effective = NodeBase + Σ(Deltaᵢ)                    // if CLAMP_0_1 bit clear
```

### 4.5 Input Normalization (0–1000)

All parameters accept **integer input in the 0–1000 range** at the API boundary:

| Polarity | API Range | Internal Q16.16 Range |
|:---|:---|:---|
| Unipolar | `0–1000` | `0–65536` |
| Bipolar | `-1000–1000` | `-65536–65536` |

The bridge converts at the boundary:

```typescript
// Bridge conversion: 0–1000 → Q16.16
const fixed = (value * 65536 / 1000) | 0;
```

**Why 0–1000:**
- Integer API — no `.0` suffixes, no float precision bugs
- 1000 steps exceeds MIDI resolution (128) by 8×
- Matches existing synapse weight range (also 0–1000)
- Modulation engine is domain-agnostic: it doesn't care whether the developer's original input is MIDI (0–127), percentage (0–100), or decibels. They normalize to 0–1000 before calling `setParam()`.

The audio thread **never sees 0–1000**. All smoothing, curve evaluation, and delta math operates on Q16.16, giving sub-step precision (65.536 internal steps per API step) for smooth interpolation.

### 4.6 Dual-Layer Polarity

**Parameter polarity** (input domain) and **modulator polarity** (output behavior) are independent:

**Parameter polarity** = what range the raw input lives in. Inherent to the parameter's nature:

| Parameter | Polarity | API Range | Why |
|:---|:---|:---|:---|
| Volume | Unipolar | 0–1000 | Volume can't be negative |
| Intensity | Unipolar | 0–1000 | Absence to presence |
| Pan | Bipolar | -1000–1000 | Left/right, center is zero |
| Swing | Bipolar | -1000–1000 | Behind/ahead of beat |
| Pitch Bend | Bipolar | -1000–1000 | Down/up from center |

Set on `Param.create()`. Stored in `PARAM.FLAGS.BIPOLAR` (bit 1).

**Modulator polarity** = can this modulator push the target property below its base value?

- **Unipolar mod:** `delta ∈ [0, Amount]` — only adds
- **Bipolar mod:** `delta ∈ [-Amount, +Amount]` — swings both ways

Set on the modulator (`.unipolar()` / `.bipolar()`). Stored in `PACKED_CFG_A` bit 14. Each factory sets a natural default.

Under the hood, bipolar remapping is a single operation after the curve lookup:

```
// Unipolar: curvedInput stays in [0, 65536]
// Bipolar:  curvedInput = (curvedInput * 2) - 65536 → [-65536, +65536]
```

A **unipolar** parameter (Intensity: 0–1000) can feed a **bipolar** modulator (pitch: ±12 semitones). A **bipolar** parameter (Swing: -1000–1000) can feed a **unipolar** modulator (only adds velocity, never reduces).

---

## 5. Memory Layout

### 5.1 64-Byte Node Expansion

**Change:** `NODE_SIZE_I32` from `8` to `16`. `NODE_SIZE_BYTES` from `32` to `64`.

**Rationale:**
- 64 bytes = exactly one CPU cache line (x86 and ARM). Eliminates false sharing between adjacent nodes during concurrent access.
- Provides `MOD_LIST_HEAD` field plus 7 reserved slots for future expansion.
- Memory cost: 4096 nodes × 64B = 256KB (vs. current 128KB). Negligible relative to Synapse Table (1.25MB).
- Stride math: `<< 4` (equally cheap as `<< 3`).
- Rust: maps directly to `#[repr(C, align(64))]`.

#### 5.1.1 Node Struct Layout

```typescript
export const NODE = {
  // --- Existing fields (slots 0–7, unchanged) ---
  PACKED_A:      0,   // (opcode<<24)|(pitch<<16)|(vel<<8)|flags
  BASE_TICK:     1,   // Grid-aligned timing
  DURATION:      2,   // Duration in ticks
  NEXT_PTR:      3,   // Byte offset to next node (0 = end)
  PREV_PTR:      4,   // Byte offset to prev node (0 = head)
  SOURCE_ID:     5,   // TID for identity table
  SEQ_FLAGS:     6,   // (seq<<8)|flags_ext
  LAST_PASS_ID:  7,   // Generation pruning

  // --- New fields (slots 8–15) ---
  MOD_LIST_HEAD: 8,   // Head ptr to modulation chain (NULL_PTR = none)
  RESERVED_9:    9,
  RESERVED_10:  10,
  RESERVED_11:  11,
  RESERVED_12:  12,
  RESERVED_13:  13,
  RESERVED_14:  14,
  RESERVED_15:  15,
} as const;

export const NODE_SIZE_I32 = 16;
export const NODE_SIZE_BYTES = NODE_SIZE_I32 * 4;  // 64
```

#### 5.1.2 New Flag Bit: `HAS_MODULATORS`

Added to `PACKED_A` flags byte (bits 0–7):

```typescript
export const FLAG = {
  ACTIVE:          0x01,
  MUTED:           0x02,
  DIRTY:           0x04,
  HAS_MODULATORS:  0x08,  // NEW: Node has modulator chain
  EXPRESSION_SHIFT: 4,
  EXPRESSION_MASK:  0xF0,
} as const;
```

The voice render path checks this bit for O(1) skip:

```
if (!(flags & FLAG.HAS_MODULATORS)) → skip modulation entirely
```

### 5.2 PARAMETER_TABLE

**Purpose:** Stores global parameter state. Bridge writes `RAW_VALUE`; audio engine owns all other fields.

**Location in SAB:** Appended after existing Reverse Index / Zone Config regions.

**Capacity:** 1024 slots.

**Stride:** 8 × i32 = 32 bytes per parameter.

#### 5.2.1 Parameter Struct Layout

```typescript
export const PARAM_TABLE = {
  STRIDE_I32: 8,
  STRIDE_BYTES: 32,
  DEFAULT_CAPACITY: 1024,
} as const;

export const PARAM = {
  RAW_VALUE:      0,  // Bridge or audio engine written (Q16.16)
  CURVED_VALUE:   1,  // After spatial curve (audio engine owned)
  SMOOTHED_VALUE: 2,  // After temporal smoothing (audio engine owned)
  TARGET_VALUE:   3,  // Smoother internal target (audio engine owned)
  PACKED_CFG_A:   4,  // (CurveType<<24) | (SmoothType<<23) | (SmoothFactor & 0x7FFFFF)
  PACKED_CFG_B:   5,  // External: CurveParam. Internal: (Waveform<<24) | (FrequencyQ8_24)
  FLAGS:          6,  // ACTIVE | BIPOLAR | INTERNAL_SOURCE
  PHASE:          7,  // LFO phase accumulator (audio engine owned). Also: future bezier smooth phase.
} as const;
```

#### 5.2.2 PACKED_CFG_A Bit Layout

```
Bits 31–24: CurveType (8 bits)
  0x00 = LINEAR
  0x01 = QUADRATIC
  0x02 = STEP
  0x03 = LUT (index in PACKED_CFG_B)
  0x04–0xFF = Reserved

Bit 23: SmoothType
  0 = Exponential (default)
  1 = Linear

Bits 22–0: SmoothFactor (23 bits, Q16.16 fractional)
  Range: 0–8388607
  Interpretation:
    Exponential: factor = SmoothFactor / 65536 (0.0–1.0 approx)
    Linear: rate = SmoothFactor (fixed-point units per block)
```

#### 5.2.3 FLAGS Bit Layout

```
Bit 0: ACTIVE (parameter is in use, included in batch loop)
Bit 1: BIPOLAR (range is -1.0 to +1.0 instead of 0.0 to 1.0)
Bit 2: INTERNAL_SOURCE (0 = external/bridge-driven, 1 = audio engine generates RAW_VALUE)
Bits 3–31: Reserved
```

When `INTERNAL_SOURCE` is set, `PACKED_CFG_B` encodes the LFO waveform and frequency:

```
PACKED_CFG_B (when INTERNAL_SOURCE = 1):
  Bits 31–24: Waveform (8 bits)
    0x00 = SINE
    0x01 = TRIANGLE
    0x02 = SQUARE
    0x03 = SAW
    0x04 = LUT (custom shape from LUT_POOL, index in bits 0–23)

  Bits 23–0: Frequency (Q8.24 fixed-point Hz)
    Example: 4.0 Hz = 4 << 24 = 67108864
```

`PHASE` (offset +7) is the phase accumulator, owned by the audio engine. Incremented each block by `(frequency * blockSamples / sampleRate)` scaled to a 0–`2³²` wrap-around cycle.

#### 5.2.4 SPSC Ownership

| Field | Writer | Reader |
|:---|:---|:---|
| `RAW_VALUE` | Bridge (main thread) | Audio engine |
| `CURVED_VALUE` | Audio engine | DSP voices |
| `SMOOTHED_VALUE` | Audio engine | DSP voices |
| `TARGET_VALUE` | Audio engine | Audio engine (internal) |
| `PACKED_CFG_A/B` | Bridge (at init or reconfigure) | Audio engine |
| `FLAGS` | Bridge | Audio engine |

### 5.3 MODULATION_TABLE

**Purpose:** Binds parameters to node properties. Per-node linked list (same structural pattern as Synapse Table).

**Location in SAB:** After PARAMETER_TABLE.

**Capacity:** 4096 slots (configurable).

**Stride:** 8 × i32 = 32 bytes per modulator.

#### 5.3.1 Modulator Struct Layout

```typescript
export const MOD_TABLE = {
  STRIDE_I32: 8,
  STRIDE_BYTES: 32,
  DEFAULT_CAPACITY: 4096,
} as const;

export const MOD = {
  TARGET_PTR:    0,  // Byte offset to target Node
  PARAM_ID:      1,  // Index into PARAMETER_TABLE (0–1023)
  CURRENT_STATE: 2,  // Modulator's own smoothed Y value (Q16.16)
  BASE_VALUE:    3,  // Additive window base (Q16.16)
  AMOUNT_VALUE:  4,  // Additive window amount (Q16.16)
  PACKED_CFG_A:  5,  // (TargetProperty<<24)|(TapSource<<16)|(Clamp<<15)|SmoothFactor
  PACKED_CFG_B:  6,  // (CurveType<<24)|(CurveParam / LUT Index)
  NEXT_MOD_PTR:  7,  // Next modulator for this node (NULL_PTR = end)
} as const;
```

#### 5.3.2 PACKED_CFG_A Bit Layout

```
Bits 31–24: TargetProperty (8 bits)
  0x00 = VELOCITY
  0x01 = PITCH
  0x02 = DURATION
  0x03 = TEMPO
  0x04 = FILTER_CUTOFF
  0x05 = VOLUME
  0x06 = PAN
  0x07 = SYNAPSE_WEIGHT  // Clip-level modulation (Section 9.7)
  0x08–0xFF = Reserved (user-extensible)

Bits 23–16: TapSource (8 bits)
  0x00 = SMOOTHED_VALUE (default — pre-smoothed parameter)
  0x01 = CURVED_VALUE (skip parameter smoothing)
  0x02 = RAW_VALUE (bypass all parameter processing)

Bit 15: CLAMP_0_1
  0 = Unclamped (full Int32 range)
  1 = Clamped to [0, 65536]

Bit 14: MOD_POLARITY
  0 = Unipolar (delta ∈ [0, Amount]) — default for velocity, volume
  1 = Bipolar (delta ∈ [-Amount, +Amount]) — default for pitch, pan, tempo

Bits 13–0: SmoothFactor (14 bits, modulator-level smoothing)
  0 = No modulator smoothing (pass-through)
  >0 = Exponential smooth: current += (target - current) × (factor / 16384)
```

#### 5.3.3 PACKED_CFG_B Bit Layout

```
Bits 31–24: CurveType (8 bits)
  0x00 = LINEAR (no transform)
  0x01 = QUADRATIC (input²)
  0x02 = STEP (threshold at 0.5)
  0x03 = GATE (0 below threshold, 1 above)
  0x04 = LUT (index in bits 0–23)
  0x05–0xFF = Reserved

Bits 23–0: CurveParam (24 bits)
  When CurveType = LUT: LUT slot index (0–127)
  When CurveType = QUADRATIC: exponent × 256 (fixed-point)
  When CurveType = STEP/GATE: threshold × 65536 (fixed-point)
  When CurveType = LINEAR: unused (0)
```

#### 5.3.4 Modulation Formula

For each modulator in a node's chain:

```
delta_i = Amount_i × CurvedInput_i
```

Where `CurvedInput_i` is the parameter value after the modulator's own curve transform.

Final effective value:

```
Effective = NodeOriginalValue + Σ(delta_i)
```

If `CLAMP_0_1` is set on any modulator in the chain:

```
Effective = max(0, min(65536, Effective))
```

### 5.4 LUT_POOL

**Purpose:** Shared pool of pre-computed lookup tables for complex curves (cubic beziers, arbitrary waveforms).

**Location in SAB:** After MODULATION_TABLE.

**Capacity:** 128 slots.

**Stride:** 256 × i32 = 1024 bytes per LUT.

**Total size:** 128 × 1024 = 131,072 bytes (128 KB).

#### 5.4.1 LUT Layout

Each LUT is a flat `Int32` array of 256 entries, representing the output value (Q16.16) for evenly-spaced input values from 0.0 to 1.0:

```
LUT[slot][0]   = f(0.0)     // Input = 0/255
LUT[slot][1]   = f(0.004)   // Input = 1/255
LUT[slot][2]   = f(0.008)   // Input = 2/255
...
LUT[slot][255] = f(1.0)     // Input = 255/255
```

#### 5.4.2 LUT Evaluation (Audio Thread)

```
index = (normalizedInput >> 8) & 0xFF   // Q16.16 → 0–255
output = LUT_POOL[slot * 256 + index]   // One Int32 read
```

No interpolation between entries. 256 steps provides <0.4% quantization error — inaudible for all musical parameters.

#### 5.4.3 LUT Computation (Bridge / Main Thread)

For cubic beziers (CSS `cubic-bezier(x1, y1, x2, y2)` format):

1. For each of 256 evenly-spaced `x` values (0.0 to 1.0):
   a. Solve `x(t) = target_x` for `t` using Newton-Raphson (8 iterations).
   b. Compute `y(t)` at the solved `t`.
   c. Store `toFixed16(y)` in `LUT_POOL[slot][i]`.

2. Write all 256 values via `Atomics.store` before any modulator references the slot.

#### 5.4.4 Bridge-Side LUT Lifecycle (Deduplication + Ref Counting)

The Bridge owns LUT lifetime via pre-allocated typed arrays (no `Map`, no objects):

```typescript
// Allocated once at bridge construction
private readonly lutHashes: Int32Array;     // 128 slots — curve hash
private readonly lutRefCounts: Int32Array;  // 128 slots — reference count
private lutFreeHead: number;               // free-list head index
```

**Workflow:**

1. **Hash:** Bridge hashes the curve control points (e.g., `hash([0.42, 0, 0.58, 1])`).
2. **Dedup check:** Linear probe `lutHashes` for matching hash.
   - **Match found:** Reuse that `lutIndex`, increment `lutRefCounts[lutIndex]`.
   - **No match:** Claim next free slot, compute 256 entries, write to SAB, store hash.
3. **Free:** On `CMD.DELETE_MOD`, decrement `lutRefCounts[lutIndex]`. If zero, mark slot as free (`lutHashes[slot] = 0`).

**Invariant:** LUT data is written to SAB *before* `CMD.CREATE_MOD` is enqueued. The Ring Buffer's FIFO ordering guarantees the audio thread never reads an uninitialized LUT.

### 5.5 SAB Memory Map (Updated)

With default capacities (4096 nodes, 32768 synapses, 1024 params, 4096 mods, 128 LUTs):

```
┌───────────────────────────────────────────────────────┐
│ Region                              │ Size    │ Offset │
├─────────────────────────────────────┼─────────┼────────┤
│ Header (indices 0–45)               │ 184 B   │ 0      │
│ Node Heap (4096 × 64B)              │ 256 KB  │ 184    │
│ Identity Table (8192 × 8B)          │ 64 KB   │ ~256K  │
│ Symbol Table (8192 × 8B)            │ 64 KB   │ ~320K  │
│ Groove Templates                    │ 1 KB    │ ~384K  │
│ Command Ring Buffer                 │ 1 MB    │ ~384K  │
│ Reclaim Ring Buffer                 │ 16 KB   │ ~1.4M  │
│ Synapse Table (32768 × 20B)         │ 640 KB  │ ~1.4M  │
│ Reverse Index (256 × 4B)            │ 1 KB    │ ~2.0M  │
│ PARAMETER_TABLE (1024 × 32B) [NEW]  │ 32 KB   │ ~2.0M  │
│ MODULATION_TABLE (4096 × 32B) [NEW] │ 128 KB  │ ~2.1M  │
│ LUT_POOL (128 × 1024B) [NEW]        │ 128 KB  │ ~2.2M  │
├─────────────────────────────────────┼─────────┼────────┤
│ TOTAL                               │ ~2.3 MB │        │
└───────────────────────────────────────────────────────┘
```

#### 5.5.1 New Header Fields

```typescript
// Added to HDR (using next available indices after SYNAPSE_TOMBSTONES = 45)
export const HDR = {
  // ... existing fields ...

  // Modulation Header (RFC-050 v2)
  PARAM_TABLE_PTR:       46,  // Byte offset to PARAMETER_TABLE
  PARAM_TABLE_CAPACITY:  47,  // Number of parameter slots (default: 1024)
  MOD_TABLE_PTR:         48,  // Byte offset to MODULATION_TABLE
  MOD_TABLE_CAPACITY:    49,  // Number of modulator slots (default: 4096)
  LUT_POOL_PTR:          50,  // Byte offset to LUT_POOL
  LUT_POOL_CAPACITY:     51,  // Number of LUT slots (default: 128)
  ACTIVE_PARAM_COUNT:    52,  // [ATOMIC] Active parameters for batch loop
  MOD_ALLOC_HEAD:        53,  // Modulator free-list head (allocator)
} as const;
```

> **Note:** `HEAP_START_OFFSET` must be updated to reflect the expanded header (currently 184 bytes / 46 indices → expands to include new indices 46–53).

#### 5.5.2 New Offset Functions

```typescript
export function getParamTableOffset(
  nodeCapacity: number,
  synapseCapacity?: number
): number {
  return getReverseIndexOffset(nodeCapacity, synapseCapacity)
    + REVERSE_INDEX.BUCKET_COUNT * 4;
}

export function getModTableOffset(
  nodeCapacity: number,
  synapseCapacity?: number,
  paramCapacity?: number
): number {
  const effectiveParamCapacity = paramCapacity ?? PARAM_TABLE.DEFAULT_CAPACITY;
  return getParamTableOffset(nodeCapacity, synapseCapacity)
    + effectiveParamCapacity * PARAM_TABLE.STRIDE_BYTES;
}

export function getLutPoolOffset(
  nodeCapacity: number,
  synapseCapacity?: number,
  paramCapacity?: number,
  modCapacity?: number
): number {
  const effectiveModCapacity = modCapacity ?? MOD_TABLE.DEFAULT_CAPACITY;
  return getModTableOffset(nodeCapacity, synapseCapacity, paramCapacity)
    + effectiveModCapacity * MOD_TABLE.STRIDE_BYTES;
}
```

---

## 6. Smoothing Architecture

### 6.1 Dual-Layer Design

Smoothing operates at two independent layers:

**Layer 1 — Parameter-level (global):** Applied once per block during the batch parameter pass. All modulators reading this parameter receive pre-smoothed values. This handles the 95% case — preventing zipper noise on knob turns.

**Layer 2 — Modulator-level (per-binding):** Applied during lazy voice evaluation. Allows per-binding artistic shaping — e.g., a slow filter sweep even though the underlying parameter responds quickly.

### 6.2 Smoothing Types

#### 6.2.1 Exponential (Default)

```
smoothed = smoothed + (target - smoothed) × factor
```

- One multiply, one add. Branchless.
- `factor` ∈ (0.0, 1.0): 0.01 = glacial (~2s settle), 0.1 = moderate (~200ms), 0.5 = snappy (~20ms).
- Natural ease-out feel. Fast initial response, asymptotic approach.
- Encoded: `SmoothType bit = 0`.

#### 6.2.2 Linear (Opt-in)

```
diff = target - smoothed
smoothed = smoothed + clamp(diff, -rate, +rate)
```

- Constant-rate approach. Arrival time is deterministic: `T = distance / rate`.
- Use cases: tempo ramps, synchronized volume fades, guaranteed crossfade timing.
- Encoded: `SmoothType bit = 1`. `SmoothFactor` = rate in fixed-point units per block.

### 6.3 TapSource Escape Hatch

Each modulator selects which parameter value to read via `TapSource` (bits 16–23 of `PACKED_CFG_A`):

| TapSource | Field Read | Use Case |
|:---|:---|:---|
| `0x00` | `SMOOTHED_VALUE` | Default — fully smoothed |
| `0x01` | `CURVED_VALUE` | Skip smoothing, keep spatial curve |
| `0x02` | `RAW_VALUE` | Bypass all processing — direct bridge value |

```typescript
// API: bypass parameter smoothing for this specific binding
.mod(Intensity).tapRaw().amount(0.3)
```

---

## 7. Evaluation Strategy

### 7.1 Hybrid: Batch Parameters + Lazy Modulators

#### 7.1.1 Pass 1 — Start of Block (Batch-Active Parameter Loop)

At the beginning of each audio block (~128 samples, ~2.7ms at 48kHz), before node traversal:

```
for each paramId in 0..ACTIVE_PARAM_COUNT:
    param = PARAMETER_TABLE[paramId]
    if !(param.FLAGS & ACTIVE): continue

    // Step 0: Internal source generation (LFO)
    if (param.FLAGS & INTERNAL_SOURCE):
        phase = param.PHASE
        waveform = (param.PACKED_CFG_B >> 24) & 0xFF
        raw = generateWaveform(phase, waveform)  // pure math, zero alloc
        Atomics.store(sab, paramOffset + PARAM.RAW_VALUE, raw)
        phaseIncrement = computePhaseIncrement(param.PACKED_CFG_B, blockSize, sampleRate)
        Atomics.store(sab, paramOffset + PARAM.PHASE, (phase + phaseIncrement) & 0xFFFFFFFF)
    else:
        raw = param.RAW_VALUE  // externally written by bridge

    // Step 1: Spatial curve
    curved = applyCurve(raw, param.PACKED_CFG_A, param.PACKED_CFG_B)
    Atomics.store(sab, paramOffset + PARAM.CURVED_VALUE, curved)

    // Step 2: Temporal smoothing
    target = curved
    smoothed = param.SMOOTHED_VALUE
    smoothType = (param.PACKED_CFG_A >> 23) & 1
    factor = param.PACKED_CFG_A & 0x7FFFFF

    if smoothType == 0:  // Exponential
        smoothed = smoothed + ((target - smoothed) * factor) >> 16
    else:                // Linear
        diff = target - smoothed
        smoothed = smoothed + clamp(diff, -factor, factor)

    Atomics.store(sab, paramOffset + PARAM.SMOOTHED_VALUE, smoothed)
```

**Cost:** O(active_params). Typically 5–50 params × 1 multiply = microseconds. Negligible.

#### 7.1.2 Pass 2 — During Render (Lazy Per-Voice Modulation)

When a `BasicVoice` renders audio, it checks its assigned node:

```
packed = Atomics.load(sab, nodeOffset + NODE.PACKED_A)
if !(packed & FLAG.HAS_MODULATORS): → use original pitch/velocity, skip

modPtr = Atomics.load(sab, nodeOffset + NODE.MOD_LIST_HEAD)
velocityDelta = 0
pitchDelta = 0

while modPtr != NULL_PTR:
    mod = MODULATION_TABLE[modPtr]
    paramId = mod.PARAM_ID
    tapSource = (mod.PACKED_CFG_A >> 16) & 0xFF

    // Select tap
    paramValue = match tapSource:
        0 → Atomics.load(sab, paramOffset + PARAM.SMOOTHED_VALUE)
        1 → Atomics.load(sab, paramOffset + PARAM.CURVED_VALUE)
        2 → Atomics.load(sab, paramOffset + PARAM.RAW_VALUE)

    // Apply modulator curve
    curvedInput = applyModCurve(paramValue, mod.PACKED_CFG_B)

    // Compute delta
    delta = (mod.AMOUNT_VALUE * curvedInput) >> 16  // Q16.16 multiply

    // Optional: modulator-level smoothing
    modSmoothFactor = mod.PACKED_CFG_A & 0x7FFF
    if modSmoothFactor > 0:
        current = mod.CURRENT_STATE
        delta = current + ((delta - current) * modSmoothFactor) >> 15
        Atomics.store(sab, modOffset + MOD.CURRENT_STATE, delta)

    // Accumulate by target property
    targetProp = (mod.PACKED_CFG_A >> 24) & 0xFF
    match targetProp:
        VELOCITY → velocityDelta += delta
        PITCH    → pitchDelta += delta
        ...

    modPtr = mod.NEXT_MOD_PTR

// Apply deltas
effectiveVelocity = originalVelocity + velocityDelta
effectivePitch = originalPitch + pitchDelta

// Clamp if any modulator in chain had CLAMP_0_1 set
if velocityClamped:
    effectiveVelocity = max(0, min(65536, effectiveVelocity))
```

**Cost:** O(polyphony × mods_per_voice). For 32 voices × 3 mods each = 96 evaluations. Sub-microsecond.

### 7.2 Why Not Batch Modulators

A 5-minute track with 10,000 modulated notes would force 10,000 LUT evaluations per block (every 2.7ms) for notes that won't produce sound for minutes. With lazy evaluation, only the ~32 active voices traverse their chains — a 300× reduction.

---

## 8. Command Protocol

### 8.1 New Command Opcodes

```typescript
export const CMD = {
  // ... existing opcodes 1–6 ...
  CREATE_MOD:     7,   // Create and link a modulator
  DELETE_MOD:     8,   // Unlink and free a modulator
} as const;
```

### 8.2 CMD.CREATE_MOD

**Payload:** `[CMD.CREATE_MOD, NodePtr, ModulatorPtr, 0]`

**Protocol:**

1. **Bridge pre-writes** all config fields to `MODULATION_TABLE[ModulatorPtr]` via `Atomics.store`:
   - `TARGET_PTR`, `PARAM_ID`, `BASE_VALUE`, `AMOUNT_VALUE`, `PACKED_CFG_A`, `PACKED_CFG_B`
   - `CURRENT_STATE = 0`, `NEXT_MOD_PTR = NULL_PTR`

2. **Bridge enqueues** `CMD.CREATE_MOD` via Ring Buffer.

3. **Worker processes** (during `poll()` → `processCommands()`):
   a. Read `NodePtr` and `ModulatorPtr` from command.
   b. Set `FLAG.HAS_MODULATORS` on the target node's `PACKED_A`.
   c. Link `ModulatorPtr` into the node's `MOD_LIST_HEAD` chain:
      ```
      newMod.NEXT_MOD_PTR = node.MOD_LIST_HEAD
      node.MOD_LIST_HEAD = ModulatorPtr
      ```
   d. Increment modulator tracking counter.

### 8.3 CMD.DELETE_MOD

**Payload:** `[CMD.DELETE_MOD, NodePtr, ModulatorPtr, 0]`

**Protocol:**

1. **Bridge enqueues** `CMD.DELETE_MOD` via Ring Buffer.

2. **Worker processes:**
   a. Traverse `MOD_LIST_HEAD` chain to find `ModulatorPtr`.
   b. Unlink from chain (update previous node's `NEXT_MOD_PTR`).
   c. Free modulator slot (return to allocator).
   d. If chain is now empty, clear `FLAG.HAS_MODULATORS` on the node.

### 8.4 Direct Updates (No Command Needed)

| Operation | Method |
|:---|:---|
| `setParam(id, value)` | `Atomics.store(sab, paramOffset + PARAM.RAW_VALUE, toFixed16(value))` |
| Update `AMOUNT_VALUE` | `Atomics.store(sab, modOffset + MOD.AMOUNT_VALUE, toFixed16(newAmount))` |
| Update `PACKED_CFG_A/B` | `Atomics.store(sab, modOffset + MOD.PACKED_CFG_A, newPacked)` |

These are SPSC-safe because the Bridge is the sole writer, the audio engine is the sole reader, and each field is a single `Int32` (atomically aligned).

---

## 9. Composition API

### 9.1 Parameter IDs

User-defined per composition via `as const` objects (matching existing codebase convention):

```typescript
const PARAM = {
  Intensity: 0,
  CrowdEnergy: 1,
  Grime: 2,
  SongProgress: 3,
} as const;
```

Framework provides 1024 slots. User assigns meaning. Compiles to plain numbers.

### 9.2 Parameters as Entities

```typescript
const Intensity = Param.create(PARAM.Intensity)
  .smooth(0.95)           // Exponential, factor 0.95
  .curve('easeIn')        // Spatial curve
  .bipolar(false);        // 0–1000 range

const SongProgress = Param.create(PARAM.SongProgress)
  .smooth(0.3, 'linear')  // Linear, rate 0.3
  .curve([0.42, 0, 0.58, 1]);  // Cubic bezier via LUT

// Internal LFO source — audio engine generates value each block
const Vibrato = Param.create(PARAM.Vibrato)
  .lfo('sine', 4.0)       // Sine wave at 4Hz
  .bipolar(true);          // -1000 to +1000

const Tremolo = Param.create(PARAM.Tremolo)
  .lfo('triangle', 2.0)   // Triangle at 2Hz
  .smooth(0.05);           // Smooth the LFO output (rounds corners)
```

#### 9.2.1 Param Interface

```typescript
interface IParam {
  readonly paramId: number;

  /** Set smoothing factor and type. */
  smooth(factor: number, type?: 'exponential' | 'linear'): this;

  /** Set spatial curve. Named preset or cubic bezier control points. */
  curve(type: string | [number, number, number, number]): this;

  /** Set range polarity. */
  bipolar(enabled: boolean): this;

  /** Set as internal LFO source. Audio engine generates value each block. */
  lfo(waveform: 'sine' | 'triangle' | 'square' | 'saw', frequencyHz: number): this;

  /** Register this parameter with the bridge (writes config to SAB). */
  register(bridge: SiliconBridge): void;
}
```

### 9.3 Typed Modulator Factories

```typescript
const intensityVel = Modulator.velocity(Intensity)
  .base(0.7)         // Q16.16: 45875
  .amount(0.3)       // Q16.16: 19661
  .easeIn();         // Quadratic curve

const energyPitch = Modulator.pitch(CrowdEnergy)
  .amount(12)        // 12 semitones
  .curve([0.42, 0, 0.58, 1]);
```

Each factory method knows its property's:
- Natural range and units
- Default clamping behavior
- Domain-specific convenience methods

#### 9.3.1 Factory Methods

```typescript
class Modulator {
  /** Velocity modulator. Range: 0–1, clamped by default. */
  static velocity(param: IParam): IVelocityModulator;

  /** Pitch modulator. Range: semitones (unbounded). */
  static pitch(param: IParam): IPitchModulator;

  /** Tempo modulator. Range: BPM, floor-clamped at 20. */
  static tempo(param: IParam): ITempoModulator;

  /** Filter cutoff modulator. Range: Hz (unbounded). */
  static filter(param: IParam): IFilterModulator;

  /** Volume modulator. Range: 0–1, clamped by default. */
  static volume(param: IParam): IVolumeModulator;

  /** Pan modulator. Range: -1 to +1, clamped. */
  static pan(param: IParam): IPanModulator;

  /** Synapse weight modulator. Range: 0–1000, clamped. Clip-level gating. */
  static synapseWeight(param: IParam): ISynapseWeightModulator;
}
```

#### 9.3.2 Base Modulator Interface

```typescript
interface IModulatorBase<T extends IModulatorBase<T>> {
  /** Set the additive window base value. */
  base(value: number): T;

  /** Set the additive window amount (maximum delta). */
  amount(value: number): T;

  /** Set modulator-level smoothing. */
  smooth(factor: number, type?: 'exponential' | 'linear'): T;

  /** Set modulator curve — named preset or bezier control points. */
  curve(type: string | [number, number, number, number]): T;

  // --- Polarity ---

  /** Unipolar output: delta ∈ [0, Amount]. */
  unipolar(): T;

  /** Bipolar output: delta ∈ [-Amount, +Amount]. */
  bipolar(): T;

  // --- Built-in curve shapes ---

  /** Linear (no transform). */
  linear(): T;

  /** Quadratic ease-in. */
  easeIn(): T;

  /** Quadratic ease-out. */
  easeOut(): T;

  /** Bipolar linear: -1 → 0 → +1. Standard panning/pitch seesaw. */
  centered(): T;

  /** V-shape: 1 → 0 → 1. Increase away from center. */
  diverge(): T;

  /** Inverse V: -1 → 1 → -1. Increase at center, decrease at extremes. */
  converge(): T;

  /** Sine wave: smooth bipolar wobble. Vibrato, organic modulation. */
  symmetric(): T;

  /** Inverted linear: 0 → -1. Turns value down as param rises. */
  ducker(): T;

  // --- Tap source (aliases: tapRaw/direct, tapCurved, tapSmoothed) ---

  /** Read SMOOTHED_VALUE (default — inherits parameter personality). */
  tapSmoothed(): T;

  /** Read CURVED_VALUE (skip smoothing, keep spatial curve). */
  tapCurved(): T;

  /** Read RAW_VALUE (bypass all processing — direct human input). */
  tapRaw(): T;

  /** Alias for tapRaw(). */
  direct(): T;
}
```

#### 9.3.3 Property-Specific Interfaces

```typescript
interface IVelocityModulator extends IModulatorBase<IVelocityModulator> {
  // Default polarity: UNIPOLAR (only adds velocity)
  // Default clamping: CLAMP_0_1 = true
}

interface IPitchModulator extends IModulatorBase<IPitchModulator> {
  /** Convenience: set amount in octaves (amount × 12). */
  octaves(n: number): this;
  // Default polarity: BIPOLAR (pitch bends both ways)
  // Default clamping: CLAMP_0_1 = false (unbounded)
}

interface ITempoModulator extends IModulatorBase<ITempoModulator> {
  // Default polarity: BIPOLAR (speed up or slow down)
  // Default clamping: floor clamp at 20 BPM
}

interface IFilterModulator extends IModulatorBase<IFilterModulator> {
  // Default polarity: UNIPOLAR
  // Default clamping: CLAMP_0_1 = false (unbounded Hz)
}

interface IVolumeModulator extends IModulatorBase<IVolumeModulator> {
  // Default polarity: UNIPOLAR (only adds volume)
  // Default clamping: CLAMP_0_1 = true
}

interface IPanModulator extends IModulatorBase<IPanModulator> {
  // Default polarity: BIPOLAR (left/right)
  // Default clamping: clamped to [-65536, 65536]
}

interface ISynapseWeightModulator extends IModulatorBase<ISynapseWeightModulator> {
  // Default polarity: UNIPOLAR
  // Default clamping: CLAMP_0_1 = true (0–1000)
  // Applied during synapse resolution, not voice rendering
}
```

### 9.4 Attachment — Reusable Modulators

```typescript
Clip.melody()
  .note('C4').velocity(0.7, intensityVel)    // Explicit base + modulator
  .note('E4').velocity(intensityVel)          // Modulator's internal base
  .note('G4').velocity(0.9, intensityVel, energyVel)  // Two modulators
```

When a `Modulator` is passed to a property method:
1. Bridge allocates a `MODULATION_TABLE` slot.
2. Bridge writes config fields via `Atomics.store`.
3. Bridge enqueues `CMD.CREATE_MOD` with `[NodePtr, ModulatorPtr]`.

### 9.5 Inline Cursors

Property methods return a typed cursor with the same interface as the corresponding `Modulator` factory, plus escape methods back to the clip:

```typescript
Clip.melody()
  .note('C4')
  .velocity(0.7)                                // Returns VelocityModCursor
    .mod(Intensity).amount(0.3).easeIn()        // First modulator
    .mod(CrowdEnergy).amount(0.1).linear()      // Second modulator (additive)
  .note('E4')                                   // Escape back to clip
```

#### 9.5.1 Cursor Interface

```typescript
interface IModulatableCursor<TCursor, TClip> {
  /** Begin a modulation binding to a parameter. */
  mod(param: IParam): IModulatorCursorBinding<TCursor, TClip>;
}

interface IModulatorCursorBinding<TCursor, TClip>
  extends IModulatorBase<IModulatorCursorBinding<TCursor, TClip>> {

  /** Chain another modulator (additive). */
  mod(param: IParam): IModulatorCursorBinding<TCursor, TClip>;

  // --- Escape methods (return to parent clip/cursor) ---
  note(pitch: string | number, duration?: number): TClip;
  rest(duration?: number): TClip;
  chord(pitches: (string | number)[], duration?: number): TClip;
  // ... all other clip methods as escape hatches ...
}
```

The cursor IS `Modulator.velocity()` (or whichever property) + escape methods. Same interface, inline lifecycle. Both paths produce identical `MODULATION_TABLE` entries.

### 9.6 Runtime Parameter Updates

```typescript
// Live parameter scrubbing (0–1000 integer input)
bridge.setParam(PARAM.Intensity, 750);      // Unipolar: 75%
bridge.setParam(PARAM.Swing, -300);          // Bipolar: 30% behind beat
bridge.setParam(PARAM.CrowdEnergy, 500);     // Unipolar: 50%
```

```typescript
// Inside SiliconBridge
setParam(paramId: number, value: number): void {
  const offset = this.paramTableOffsetI32 + paramId * PARAM_TABLE.STRIDE_I32;
  // Convert 0–1000 → Q16.16
  const fixed = (value * 65536 / 1000) | 0;
  Atomics.store(this.sab, offset + PARAM.RAW_VALUE, fixed);
}
```

### 9.7 Clip-Level Modulation (Synapse Weight Modulation)

Modulation can target **synapse weights**, not just note properties. This enables clip-level gating — controlling whether an entire clip fires based on parameter state.

#### 9.7.1 Semantics

| Level | Controls | Evaluated at | Zero means |
|:---|:---|:---|:---|
| **Note-level** (velocity, pitch, etc.) | Individual note properties | Voice render time | Silent note (voice still allocated) |
| **Clip-level** (synapse weight) | Whether the clip plays at all | Synapse resolution time | Skip entire clip — no notes scheduled, no voices allocated, zero DSP cost |

Clip-level modulation is strictly cheaper than note-level: if effective weight = 0, the sequencer skips the target clip entirely.

#### 9.7.2 Mechanism

Synapse weight modulation uses the same `MODULATION_TABLE` as note-level modulation. The modulator's `TargetProperty = SYNAPSE_WEIGHT` (0x07). The `TARGET_PTR` points to the synapse entry rather than a node.

During synapse resolution (when a clip ends and outgoing synapses are evaluated):

```
for each synapse from sourcePtr:
    effectiveWeight = synapse.WEIGHT
    if synapse has HAS_MODULATORS:
        effectiveWeight = effectiveWeight + Σ(mod deltas for SYNAPSE_WEIGHT)
        effectiveWeight = clamp(effectiveWeight, 0, 1000)
    if effectiveWeight > 0:
        fire noteOn events on targetPtr with velocity scaled by (effectiveWeight / 1000)
```

#### 9.7.3 API

**Reusable modulator:**

```typescript
const sceneGate = Modulator.synapseWeight(Scene)
  .base(1000)         // Full weight at Scene=0
  .amount(-1000)       // Drops to 0 at Scene=1
  .easeIn();

parent.linkTo(verseClip, sceneGate);    // Verse fades out as Scene rises
```

**Inline cursor:**

```typescript
parent.linkTo(verseClip)
  .mod(Scene).base(1000).amount(-1000).easeIn()
```

### 9.8 Crossfade as Composition Pattern

Crossfade is **not a primitive** — it is a composition pattern achieved by binding opposing synapse weight modulators to the same parameter on parallel synapses.

#### 9.8.1 Example

```typescript
const Scene = Param.create(PARAM.Scene).smooth(0.9);

parent.linkTo(verseClip)
  .mod(Scene).base(1000).amount(-1000)    // 1000→0 as Scene goes 0→1

parent.linkTo(chorusClip)
  .mod(Scene).base(0).amount(1000)        // 0→1000 as Scene goes 0→1
```

#### 9.8.2 Behavior During Transition

1. **Scene at 0.0:** Verse weight = 1000 (fires), Chorus weight = 0 (skipped).
2. **Scene at 0.5 (mid-crossfade):** Both weights > 0. Both clips fire simultaneously. Verse notes at 50% velocity, chorus notes at 50% velocity.
3. **Scene at 1.0:** Verse weight = 0 (skipped), Chorus weight = 1000 (fires).
4. **Verse's active voices** ring out naturally via DSP-layer ADSR release tails (polyphonic persistence, Section 11.1).

The smoothing factor on the `Scene` parameter controls crossfade speed. No crossfade-specific code exists in the engine.

---

## 10. Platform-Agnostic Sequencer

### 10.1 Extraction

Sequencing logic currently resides in `packages/web/src/runtime/processor.ts`. This RFC mandates its extraction into `packages/kernel`.

### 10.2 Kernel-Side Sequencer

```typescript
interface IEventSink {
  noteOn(channelId: number, pitch: number, velocity: number,
         gateOffset: number, expressionId: number): void;
  noteOff(channelId: number, pitch: number, expressionId: number): void;
  controlChange(channelId: number, controller: number, value: number): void;
}

interface ISequencer {
  /**
   * Advance the sequencer by one audio block.
   *
   * 1. Evaluates all active parameters (batch).
   * 2. Traverses node chain for [startTick, endTick).
   * 3. Routes note/CC events to the EventSink.
   *
   * Modulation is evaluated lazily by the DSP layer during voice rendering,
   * not during this traversal.
   */
  advance(startTick: number, endTick: number, frameCount: number,
          samplesPerTick: number): void;
}
```

### 10.3 Web-Side Thin Shell

```typescript
// packages/web/src/runtime/processor.ts — after extraction
class SymphonyScriptProcessor extends AudioWorkletProcessor {
  private sequencer: ISequencer;
  private engine: Engine;       // implements IEventSink

  process(inputs, outputs): boolean {
    this.linker.poll();
    const startTick = this.linker.getPlayheadTick();
    const ticksInBlock = frameCount / samplesPerTick;
    const endTick = startTick + ticksInBlock;

    this.sequencer.advance(startTick, endTick, frameCount, samplesPerTick);

    const rendered = this.engine.render();
    this.copyToOutput(rendered, outputs[0]);
    this.linker.setPlayheadTick(endTick);
    return true;
  }
}
```

### 10.4 Portability Win

The `ISequencer` and `IEventSink` interfaces are platform-agnostic. Porting to Rust or native audio backends requires only rewriting the thin I/O shell. The sequencer + parameter evaluation logic stays identical.

---

## 11. DSP/Kernel Boundary

### 11.1 Polyphonic Persistence

When a synaptic weight drops to 0:

1. **Sequencer** stops scheduling new `noteOn` events for that path.
2. **Already-active voices** hit their `DURATION` → sequencer fires `noteOff`.
3. **DSP layer** transitions voice to `VoiceState.RELEASE` → `EnvelopeModule` autonomously renders release tail.
4. **`isNearSilent()`** detects silence → voice transitions to `VoiceState.IDLE` → reclaimed.

No SAB coordination needed. No `VOICE_ID` or `ENVELOPE_ID` in the node struct.

### 11.2 Voice Independence

The kernel never receives a voice index. Communication is one-way:

```
Kernel: "Channel 1, play pitch 60, velocity 0.8"  →  DSP
DSP:    (internally) findIdleVoice() → allocate → render → release → reclaim
```

Changing a synth from 8-voice polyphonic to monophonic with glide requires zero changes to the SAB, sequencer, or modulation system. Only the DSP layer's `maxVoices` and `stealPolicy` change.

---

## 12. Multi-Modulator Combination

### 12.1 Additive Delta Summation

When multiple modulators target the same property on the same node:

```
Effective = NodeOriginalValue + Σ(Amount_i × CurvedInput_i)
```

### 12.2 Rationale

- **Matches hardware modular synth behavior** — multiple CV cables into one jack sum their voltages.
- **Multiplicative rejected** — spirals out of control; `A × B × C` at >1.0 values explodes.
- **Last-write-wins rejected** — kills complex sound design. A live-coder needs LFO + macro knob on the same filter simultaneously.
- **Addition is commutative** — no order dependence in chain traversal.

### 12.3 Clamping

Applied once at the end of the chain, after all deltas are summed. Controlled by `CLAMP_0_1` bit per modulator:

```
if any modulator in chain has CLAMP_0_1:
    Effective = max(0, min(65536, Effective))
```

---

## 12A. Deterministic Synapse Resolution (Replaces Stochastic Selection)

### 12A.1 Removal of Randomized Weight Distribution

The existing `SynapticCursor` class implements **stochastic (PRNG-based) synapse selection**: when multiple synapses share the same source, a weighted random roll picks one winner. This is **removed entirely**.

**Why:** With deterministic parameter-driven modulation, randomized selection is unnecessary and harmful:
- Non-reproducible playback (PRNG state diverges across runs)
- Unpredictable routing conflicts with the deterministic modulation model
- Modulated synapse weights provide strictly superior control over routing

### 12A.2 New Model: All-Fire with Weight Gating

All synapses with effective weight > 0 fire. Weight acts as a **velocity multiplier**, not a probability:

```
for each synapse from sourcePtr:
    effectiveWeight = evaluateSynapseWeight(synapse)  // includes modulation
    if effectiveWeight > 0:
        velocityScale = effectiveWeight / 1000
        for each note in targetClip within [startTick, endTick):
            fire noteOn(pitch, originalVelocity × velocityScale)
```

This transforms the synapse graph from "choose one path" to "fan out to all active paths, weighted."

### 12A.3 SynapticCursor Deletion

`packages/synaptic/src/SynapticCursor.ts` is **deleted in its entirety**. Its surviving logic folds into the kernel-side `Sequencer`:

| SynapticCursor method | Destination |
|:---|:---|
| `findHeadSlot()` (hash lookup) | `Sequencer` or `SynapseResolver` helper |
| `collectCandidates()` (chain traversal) | `Sequencer` — simplified to "collect all, no selection" |
| `selectWinner()` | **Deleted** — no selection, all weight > 0 fire |
| `nextRandom()` / `prngState` / `setSeed()` | **Deleted** — no PRNG |
| `pendingJitter` / `hasJitter()` / `consumeJitter()` | **Deleted** — timing variation via modulation |
| `candJitters` array | **Deleted** |
| Quota enforcement | `Sequencer` (retained — prevents runaway fan-out) |
| Plasticity callback | `Sequencer` (retained if plasticity feature is kept) |

### 12A.4 Synapse Table Field Changes

**`WEIGHT_DATA` (offset +2):**

| Before | After |
|:---|:---|
| `weight(16b) \| jitter(16b)` | `weight(16b) \| reserved(16b)` |

The jitter field (bits 16–31) is zeroed and reserved. The `SYN_PACK.JITTER_MASK` and `JITTER_SHIFT` constants are removed.

### 12A.5 API Changes

| Method | Before | After |
|:---|:---|:---|
| `SynapticNode.linkTo()` | `linkTo(target, weight?, jitter?)` | `linkTo(target, weight?)` |
| `SiliconBridge.connect()` | `connect(srcId, tgtId, weight?, jitter?)` | `connect(srcId, tgtId, weight?)` |
| `SiliconBridge.connectAsync()` | `connectAsync(srcPtr, tgtPtr, weight?, jitter?)` | `connectAsync(srcPtr, tgtPtr, weight?)` |
| `SynapseAllocator.connect()` | `connect(src, tgt, weight, jitter)` | `connect(src, tgt, weight)` |
| `SynapseResolutionCallback` | `(targetPtr, jitter, weight, synapsePtr)` | Removed (no callback-based resolution) |

### 12A.6 Files Affected

| File | Change |
|:---|:---|
| `SynapticCursor.ts` | **Deleted** |
| `SynapticNode.ts` | Remove `jitter` param from `linkTo()` / `connect()` |
| `silicon-bridge.ts` | Remove `jitter` from `connect()`, `connectAsync()`, snapshots |
| `synapse-allocator.ts` | Remove `jitter` from `connect()`, update `WEIGHT_DATA` packing |
| `constants.ts` | Remove `SYN_PACK.JITTER_MASK/SHIFT`, mark bits 16–31 as reserved |
| `types.ts` | Remove `jitter` from `SynapseResolutionCallback`, `SynapseSnapshot` |
| `integration.test.ts` | Remove jitter test cases |
| `rfc-054-barrier.test.ts` | Update weight/jitter packing tests |
| `stress-tests.test.ts` | Update packed weight references |

---

## 13. Migration Plan

### 13.1 Node Size Migration (32B → 64B)

#### Source Files (8):

| File | Change Required |
|:---|:---|
| `constants.ts` | `NODE_SIZE_I32 = 16`, add `MOD_LIST_HEAD`, add `HAS_MODULATORS` flag, new `HDR` fields, new offset functions, update `calculateSABSize()` |
| `silicon-synapse.ts` | `nodeOffset()`, `writeNodeData()`, `readNodeRaw()`, hardcoded `32` on line 149, `commandBuffer` and `nodeBuf` sizing |
| `silicon-bridge.ts` | `nodeBuf = new Int32Array(16)`, `writeNodeData` calls |
| `local-allocator.ts` | Unrolled zeroing (update comment + extend to 16 fields) |
| `free-list.ts` | Uses `NODE_SIZE_I32` throughout — auto-adjusts |
| `patch.ts` | Bounds checks `o >= NODE_SIZE_I32` — auto-adjusts |
| `init.ts` | Uses `NODE_SIZE_BYTES` — auto-adjusts |
| `types.ts` | Doc comment "Int32Array(8)" → "Int32Array(16)" |

#### Web Package (2):

| File | Change |
|:---|:---|
| `processor.ts` | `nodeBuf = new Int32Array(16)` |
| `processor.test.ts` | Same |

#### Test Files (7):

| File | Change |
|:---|:---|
| `silicon-linker.test.ts` | `Int32Array(8)` → `Int32Array(16)`, `NODE_SIZE_I32` references |
| `silicon-bridge.test.ts` | `NODE_SIZE_BYTES` offset calculations |
| `seq-wraparound.test.ts` | `Int32Array(8)` → `Int32Array(16)` |
| `stress-tests.test.ts` | `Int32Array(8)` → `Int32Array(16)`, zone split calculations |
| `integration.test.ts` | `Int32Array(8)` → `Int32Array(16)` |
| `k-005-reclamation.test.ts` | `NODE_SIZE_BYTES` offset calculations |
| `multi-zone.test.ts` | `NODE_SIZE_BYTES` offset calculations |

### 13.2 Phased Implementation Order

1. **Phase 1 — Constants + Node expansion.** Update `constants.ts`. All dependent code auto-adjusts via `NODE_SIZE_I32` / `NODE_SIZE_BYTES`. Update `Int32Array(8)` allocations. Run existing test suite — must pass with zero behavioral changes.

2. **Phase 2 — Stochastic removal.** Delete `SynapticCursor.ts`. Remove `jitter` from all APIs. Remove `SYN_PACK.JITTER_*` constants. Implement deterministic all-fire resolution. Update all affected tests.

3. **Phase 3 — New SAB tables.** Add `PARAMETER_TABLE`, `MODULATION_TABLE`, `LUT_POOL` constants, offset functions, and `calculateSABSize()` updates. Add initialization code in `init.ts`.

4. **Phase 4 — Command protocol.** Add `CMD.CREATE_MOD` / `CMD.DELETE_MOD` handlers to `processCommands()` in `silicon-synapse.ts`.

5. **Phase 5 — Bridge integration.** Add `setParam()`, modulator allocation, LUT deduplication to `SiliconBridge`.

6. **Phase 6 — Sequencer extraction.** Move `routeNodeEvents` logic to kernel-side `Sequencer`. Add parameter batch evaluation loop. Include synapse resolution (all-fire model).

7. **Phase 7 — Composition API.** Implement `Param`, `Modulator` factories (including `Modulator.synapseWeight()`), inline cursors, and `linkTo()` modulation in `packages/composer` and `packages/synaptic`.

---

## 14. Mechanical Specifications

### 14.1 Modulator Allocator

Free-list, mirroring node allocation in `free-list.ts`. `HDR.MOD_ALLOC_HEAD` points to the first free slot. Each free slot uses `NEXT_MOD_PTR` (+7) to chain to the next free slot.

- `CMD.CREATE_MOD`: Worker pops from free list (CAS on `MOD_ALLOC_HEAD`).
- `CMD.DELETE_MOD`: Worker pushes back to free list.
- Initialized during `initSAB()` as a linked chain of all slots.

### 14.2 Error Handling

Follows existing `BRIDGE_ERR` pattern:

```typescript
export const BRIDGE_ERR = {
  // ... existing ...
  MOD_TABLE_FULL: -5,   // MODULATION_TABLE exhausted
  LUT_POOL_FULL:  -6,   // LUT_POOL exhausted
} as const;
```

`createModulator()` and `allocLut()` return error codes. Bridge-side only — the audio thread never allocates.

### 14.3 Parameter Deregistration

Set `FLAGS.ACTIVE = 0`. Modulators still referencing the slot read the frozen `SMOOTHED_VALUE`. No auto-deletion of linked modulators — they become no-ops. If the slot is reused via `Param.create()` with the same ID, existing modulators seamlessly read the new parameter.

### 14.4 Pre-Baked Shape LUT Slots

Slots 0–7 reserved for built-in shapes. Initialized during `initSAB()`. User LUTs start at slot 8.

```typescript
export const LUT_BUILTIN_COUNT = 8;
```

| Slot | Shape | Output | Method |
|:---|:---|:---|:---|
| 0 | Linear (identity) | 0 → 1 | `.linear()` |
| 1 | Centered | -1 → 0 → +1 | `.centered()` |
| 2 | Diverge (V) | 1 → 0 → 1 | `.diverge()` |
| 3 | Converge (Inv-V) | -1 → 1 → -1 | `.converge()` |
| 4 | Symmetric (sine) | -1 → +1 | `.symmetric()` |
| 5 | Ducker | 0 → -1 | `.ducker()` |
| 6–7 | Reserved | — | — |

### 14.5 Zero-Allocation Debug Inspection

Caller provides a pre-allocated buffer. Bridge fills it via `Atomics.load`. No objects created.

```typescript
// SiliconBridge
inspectParam(paramId: number, out: Int32Array): void {
  const offset = this.paramTableOffsetI32 + paramId * PARAM_TABLE.STRIDE_I32;
  for (let i = 0; i < 8; i++) {
    out[i] = Atomics.load(this.sab, offset + i);
  }
}

inspectMod(modOffset: number, out: Int32Array): void {
  const offsetI32 = modOffset / 4;
  for (let i = 0; i < 8; i++) {
    out[i] = Atomics.load(this.sab, offsetI32 + i);
  }
}
```

Consistent with `readNodeRaw()` pattern.

### 14.6 Tempo Modulation — Per-Block Recalculation

The sequencer reads `PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE` at the start of each block and derives `samplesPerTick`. Within the block, `samplesPerTick` is constant.

- At 120 BPM: ~185 blocks per beat. Tempo ramps are imperceptibly smooth.
- Max timing error: `tempoChange × blockDuration` ≈ 0.1 ticks at 2.7ms blocks. Below human perception.
- Industry standard: Ableton, Logic, Cubase all update tempo per buffer.
- Parameter smoothing handles gradual transitions (no step functions).

No sub-block subdivision. No variable-rate tick accumulation.

### 14.7 Expression DSL (`Expr`)

A unified expression system for both **derived parameter values** and **conditional routing**. All expressions are data structures — serializable, kernel-compilable, composable. No closures.

#### 14.7.1 `IExpr` Interface

```typescript
interface IExpr {
  readonly type: ExprType;
  /** Compile to kernel-side packed representation. */
  compile(): { cfgB: number; auxFields?: number[] };
  /** Serialize to JSON. */
  toJSON(): object;
}
```

#### 14.7.2 Arithmetic Operators (produce numeric values)

```typescript
class Expr {
  /** A + B */
  static add(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** A - B */
  static sub(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** (A × B) >> 16 (Q16.16 multiply) */
  static mul(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** (A << 16) / B (Q16.16 divide, B must be non-zero) */
  static div(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** min(A, B) */
  static min(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** max(A, B) */
  static max(a: IParam | IExpr, b: IParam | IExpr): IExpr;

  /** |A| (absolute value) */
  static abs(a: IParam | IExpr): IExpr;

  /** -A (negate) */
  static neg(a: IParam | IExpr): IExpr;

  /** A + (B - A) × T >> 16 (linear interpolation) */
  static lerp(a: IParam | IExpr, b: IParam | IExpr, t: IParam | IExpr): IExpr;

  /** (A × scale) >> 16 (scale by constant) */
  static scale(a: IParam | IExpr, factor: number): IExpr;

  /** Constant value (Q16.16 literal). */
  static value(n: number): IExpr;

  /** clamp(A, low, high) */
  static clamp(a: IParam | IExpr, low: number, high: number): IExpr;

  /** A mod B (modulo) */
  static mod(a: IParam | IExpr, b: IParam | IExpr): IExpr;
}
```

#### 14.7.3 Comparison Operators (produce boolean conditions)

```typescript
class Expr {
  /** A > threshold */
  static gt(a: IParam | IExpr, threshold: number): IExpr;

  /** A < threshold */
  static lt(a: IParam | IExpr, threshold: number): IExpr;

  /** A >= threshold */
  static gte(a: IParam | IExpr, threshold: number): IExpr;

  /** A <= threshold */
  static lte(a: IParam | IExpr, threshold: number): IExpr;

  /** |A - threshold| < epsilon (default epsilon = 1) */
  static eq(a: IParam | IExpr, threshold: number, epsilon?: number): IExpr;

  /** low < A < high */
  static between(a: IParam | IExpr, low: number, high: number): IExpr;

  /** A < low || A > high */
  static outside(a: IParam | IExpr, low: number, high: number): IExpr;
}
```

#### 14.7.4 Logical Operators (combine conditions)

```typescript
class Expr {
  /** A && B (both conditions true) */
  static and(a: IExpr, b: IExpr): IExpr;

  /** A || B (either condition true) */
  static or(a: IExpr, b: IExpr): IExpr;

  /** !A (negate condition) */
  static not(a: IExpr): IExpr;
}
```

#### 14.7.5 Kernel Compilation

Expressions compile to packed fields in `PACKED_CFG_B` and auxiliary storage. Simple expressions (single operator, two sources) encode directly. Complex expressions (nested) are flattened into a micro-program stored in the `LUT_POOL` region (reusing slots as instruction storage).

```
PACKED_CFG_B (when FLAGS.DERIVED = 1, simple expression):
  Bits 31–28: Operator (4 bits)
    0x0 = ADD       0x4 = MIN       0x8 = ABS       0xC = MOD
    0x1 = SUB       0x5 = MAX       0x9 = NEG
    0x2 = MUL       0x6 = LERP      0xA = SCALE
    0x3 = DIV       0x7 = CLAMP     0xB = CONST

  Bits 27–16: Source Param A (12 bits = 4096 param IDs)
  Bits 15–4:  Source Param B (12 bits)
  Bits 3–0:   Source Param C / flags (for LERP, CLAMP)
```

For nested expressions, bit 0 of the flags indicates `COMPLEX = 1`, and `PACKED_CFG_B` bits 27–4 encode a LUT_POOL slot index where the flattened instruction sequence resides.

### 14.8 Derived Parameters

A parameter whose `RAW_VALUE` is computed from other parameters' `SMOOTHED_VALUE`s.

#### 14.8.1 Creation API

```typescript
const FinalPitch = Param.derive(Expr.add(BasePitch, Expr.mul(Scene, Expr.value(12))));

const BlendedVelocity = Param.derive(
  Expr.lerp(VelocityA, VelocityB, MixParam)
);

const ClampedIntensity = Param.derive(
  Expr.clamp(Expr.add(RawIntensity, Boost), 0, 1000)
);
```

#### 14.8.2 Parameter Table Encoding

A derived parameter uses the same `PARAMETER_TABLE` slot as any other parameter:

- `FLAGS` bit 3: `DERIVED` (0 = external/LFO source, 1 = computed from expression)
- `PACKED_CFG_B`: Expression encoding (see Section 14.7.5)
- `RAW_VALUE`: Audio engine writes the computed result here each block
- `CURVED_VALUE`, `SMOOTHED_VALUE`: Processed normally after computation

The signal chain is identical: `compute RAW_VALUE from expression → curve → smooth → modulators read SMOOTHED_VALUE`.

#### 14.8.3 Evaluation Order

Derived parameters must be evaluated **after** their source parameters. The batch parameter loop runs in two passes:

```
Pass 1: Evaluate all non-derived parameters (external + LFO)
Pass 2: Evaluate all derived parameters (read sources' SMOOTHED_VALUE)
```

Circular dependencies are prevented at `Param.derive()` time — the bridge rejects expressions that reference the derived parameter itself (directly or transitively).

### 14.9 Conditional Routing via `.when()`

Synapse weight modulators can have conditions that gate their effect:

```typescript
parent.linkTo(verseClip)
  .mod(Scene)
  .base(1000)
  .amount(-1000)
  .when(Expr.gt(Scene, 500));     // Only active when Scene > 500
```

#### 14.9.1 Kernel Encoding

The condition is stored in the modulator's auxiliary field (using a reserved slot in the `MODULATION_TABLE` entry). During evaluation:

```
conditionMet = evaluateExpr(modulator.condition, PARAMETER_TABLE)
if (!conditionMet):
    delta = 0    // modulator is gated off
else:
    delta = evaluateNormally()
```

#### 14.9.2 Dual-Mode `.when()` (RFC-058 Integration)

Both serializable expressions and arrow functions are accepted:

```typescript
// Serializable — preserves phantom type
.when(Expr.gt(Scene, 500))

// Arrow — taints clip as Unserializable (RFC-058 phantom type)
.when(v => v > 500)
```

The arrow form is evaluated at composition time by the `ClipBridge`. The `Expr` form compiles to kernel-side evaluation.

---

## 15. Open Questions

None. All architectural decisions are locked.

---

## Appendix A: Decision Log

| # | Decision | Rationale |
|:---|:---|:---|
| 1 | 64-byte nodes | Cache line alignment, false sharing elimination, room for MOD_LIST_HEAD + 7 reserves |
| 2 | Three-table architecture | Direct SAB manipulation, no serialization, matches existing kernel patterns |
| 3 | Q16.16 fixed-point | `Atomics` doesn't support `Float32Array`, Rust-portable |
| 4 | User-assigned param IDs | `as const` objects, zero runtime cost, matching codebase convention |
| 5 | Score vs. Performer boundary | One-way kernel→DSP, voice lifetime in DSP only |
| 6 | Sequencer in kernel | Platform-agnostic, Rust-portable |
| 7 | Per-block parameter smoothing | ~2.7ms latency (perceptually instant), trivial CPU cost |
| 8 | Hybrid evaluation | Batch params + lazy mods = O(active_params + polyphony), not O(total_mods) |
| 9 | Additive delta combination | Commutative, matches modular synth CV mixing, safe |
| 10 | Ring buffer for mod lifecycle | Consistent with existing CMD architecture, prevents half-linked chains |
| 11 | Bridge-side LUT dedup | SoA typed arrays, no Map/objects, ref-counted slot reuse |
| 12 | Typed modulator factories + inline cursors | DX, property-specific methods, two paths same output |
| 13 | Dual-layer smoothing | Param-level global + mod-level per-binding, TapSource escape hatch |
| 14 | Parameters as entities | Config objects (curve + smooth + flags), registered with bridge |
| 15 | Clip-level synapse weight modulation | Modulate synapse weight for clip gating — weight 0 = skip entire clip |
| 16 | Crossfade as composition pattern | Not a primitive — opposing weight modulators on same param, DSP handles tails |
| 17 | Deterministic all-fire synapse resolution | All weight > 0 fire. Removes PRNG, SynapticCursor, jitter. Weight = velocity scale |
| 18 | Dual-layer polarity | Parameter polarity (input domain) + modulator polarity (output direction) are independent. MOD_POLARITY bit in PACKED_CFG_A |
| 19 | 0–1000 normalized input | Integer API, bridge converts to Q16.16. Domain-agnostic. Matches synapse weight range |
| 20 | Named shape presets + method aliases | `.centered()`, `.diverge()`, `.converge()`, `.symmetric()`, `.ducker()`. `.direct()` aliases `.tapRaw()` |
| 21 | LFO as internal parameter source | `FLAGS.INTERNAL_SOURCE` + `PACKED_CFG_B` = waveform+freq. Audio engine generates RAW_VALUE. Same signal chain |
| 22 | Per-block tempo recalculation | Sequencer reads SMOOTHED_VALUE, derives samplesPerTick. Constant within block. Industry standard |
| 23 | Free-list modulator allocator | `MOD_ALLOC_HEAD` in header. Pop on CREATE_MOD, push on DELETE_MOD. Mirrors node free-list |
| 24 | TABLE_FULL error handling | `BRIDGE_ERR.MOD_TABLE_FULL`, `LUT_POOL_FULL`. Bridge-side only. Zero-allocation |
| 25 | Parameter deregistration | `FLAGS.ACTIVE = 0`. Modulators read frozen value. No auto-cleanup |
| 26 | Pre-baked shape LUT slots 0–7 | Built-in shapes initialized at `initSAB()`. User LUTs start at slot 8 |
| 27 | Zero-alloc debug inspection | `inspectParam(id, out)` / `inspectMod(ptr, out)` with caller-owned Int32Array |
| 28 | Unified Expr DSL | Single expression system for derived values AND conditions. Data structures, not closures. Serializable, kernel-compilable |
| 29 | Derived parameters via `Param.derive(expr)` | `FLAGS.DERIVED` bit. RAW_VALUE computed from source params' SMOOTHED_VALUE. Two-pass evaluation (sources first, derived second) |
| 30 | Conditional `.when()` with dual mode | `Expr` form is serializable + kernel-compiled. Arrow form taints as `Unserializable` (RFC-058 phantom type). Conditions gate modulator delta to 0 |

---

## Appendix B: Reference Implementation Code

These implementations are provided to eliminate guesswork for implementing agents.

### B.1 `generateWaveform()` — LFO Waveform Generation

```typescript
/**
 * Generate a waveform sample from a phase accumulator.
 * Pure math, zero allocation. Audio thread safe.
 *
 * @param phase - Unsigned 32-bit phase accumulator (0 wraps to 2^32)
 * @param waveform - Waveform type (0=SINE, 1=TRIANGLE, 2=SQUARE, 3=SAW)

 * @returns Q16.16 fixed-point output in [-65536, +65536] (bipolar)
 */
function generateWaveform(phase: number, waveform: number): number {
  // Normalize phase to 0–65536 range (Q16.16 fraction of cycle)
  const norm = (phase >>> 16) & 0xFFFF;  // Top 16 bits → 0–65535

  switch (waveform) {
    case 0: { // SINE — 4th-order Taylor approximation, no Math.sin
      // Map norm to [-π, +π] as Q16.16
      // norm 0 = -π, norm 32768 = 0, norm 65535 = +π
      let x = norm - 32768;               // [-32768, +32767] = [-0.5, +0.5] in Q16
      x = (x * 201) >> 6;                 // Scale to [-π, +π] as Q16.16 (201/64 ≈ π)
      // Compute sin(x) via x - x³/6 + x⁵/120 (all in fixed-point)
      const x2 = (x * x) >> 16;           // x²
      const x3 = (x2 * x) >> 16;          // x³
      const x5 = (x3 * x2) >> 16;         // x⁵
      return x - ((x3 * 10923) >> 16) + ((x5 * 546) >> 16);
      // 10923 ≈ 65536/6, 546 ≈ 65536/120
    }
    case 1: { // TRIANGLE — linearly ramps up then down
      if (norm < 16384) {
        return (norm * 4);                 // 0 → +65536 (first quarter)
      } else if (norm < 49152) {
        return 131072 - (norm * 4);        // +65536 → -65536 (middle half)
      } else {
        return (norm * 4) - 262144;        // -65536 → 0 (last quarter)
      }
    }
    case 2: // SQUARE — binary: +1 or -1
      return norm < 32768 ? 65536 : -65536;
    case 3: // SAW — linear ramp from -1 to +1
      return (norm * 2) - 65536;
    default:
      return 0;
  }
}

/**
 * Compute phase increment per audio block.
 * @param packedCfgB - PACKED_CFG_B containing frequency in Q8.24
 * @param blockSize - Samples per block (e.g., 128)
 * @param sampleRate - Audio sample rate (e.g., 48000)

 * @returns Phase increment (unsigned 32-bit, wraps at 2^32)
 */
function computePhaseIncrement(
  packedCfgB: number,
  blockSize: number,
  sampleRate: number
): number {
  const freqQ8_24 = packedCfgB & 0x00FFFFFF;
  const freqHz = freqQ8_24 / (1 << 24);
  // Full cycle = 2^32 phase units. Per sample = (2^32 * freq) / sampleRate.
  // Per block = per sample * blockSize.
  return ((4294967296 * freqHz) / sampleRate * blockSize) >>> 0;
}
```

### B.2 Newton-Raphson Cubic Bézier Solver (LUT Computation)

```typescript
/**
 * Compute a 256-entry LUT for a cubic bézier curve.
 * Called on the main thread (bridge-side) when a new bezier curve is registered.
 *
 * @param x1, y1, x2, y2 - Bézier control points (CSS cubic-bezier format)
 * @param lutSlot - Target LUT_POOL slot index
 * @param sabI32 - SharedArrayBuffer as Int32Array
 * @param lutPoolOffsetI32 - Offset to LUT_POOL in i32 indices
 */
function computeBezierLut(
  x1: number, y1: number, x2: number, y2: number,
  lutSlot: number,
  sabI32: Int32Array,
  lutPoolOffsetI32: number
): void {
  const slotOffset = lutPoolOffsetI32 + lutSlot * 256;

  for (let i = 0; i < 256; i++) {
    const targetX = i / 255;              // Evenly spaced input 0.0–1.0
    const t = solveCubicBezierT(targetX, x1, x2);
    const y = cubicBezierY(t, y1, y2);
    const fixed = (y * 65536) | 0;        // Float → Q16.16
    Atomics.store(sabI32, slotOffset + i, fixed);
  }
}

/**
 * Solve x(t) = targetX for t using Newton-Raphson (8 iterations).
 * x(t) = 3(1-t)²t·x1 + 3(1-t)t²·x2 + t³
 */
function solveCubicBezierT(targetX: number, x1: number, x2: number): number {
  let t = targetX;  // Initial guess

  for (let i = 0; i < 8; i++) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;

    // x(t) = 3·mt²·t·x1 + 3·mt·t²·x2 + t³
    const x = 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3;
    const err = x - targetX;

    if (Math.abs(err) < 1e-7) break;

    // dx/dt = 3·mt²·x1 + 6·mt·t·(x2-x1) + 3·t²·(1-x2)
    const dx = 3 * mt2 * x1 + 6 * mt * t * (x2 - x1) + 3 * t2 * (1 - x2);

    if (Math.abs(dx) < 1e-10) break;     // Avoid division by zero

    t = t - err / dx;
    t = t < 0 ? 0 : t > 1 ? 1 : t;       // Clamp to [0, 1]
  }

  return t;
}

/**
 * Evaluate y(t) for cubic bézier.
 * y(t) = 3(1-t)²t·y1 + 3(1-t)t²·y2 + t³
 */
function cubicBezierY(t: number, y1: number, y2: number): number {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3;
}
```

### B.3 Reference Modulator Factory — `Modulator.velocity()`

```typescript
/**
 * Reference implementation of a typed modulator factory.
 * All other factories (pitch, volume, pan, tempo, filter, synapseWeight)
 * follow the same pattern — they differ only in:
 *   1. targetProperty (PACKED_CFG_A bits 31–24)
 *   2. defaultClamp (PACKED_CFG_A bit 15)
 *   3. defaultPolarity (PACKED_CFG_A bit 14)
 *   4. Domain-specific convenience methods
 */
class VelocityModulatorConfig implements IVelocityModulator {
  private _paramId: number;
  private _base: number = 0;                  // Q16.16
  private _amount: number = 0;                // Q16.16
  private _smoothFactor: number = 0;          // 14-bit
  private _clamp: boolean = true;             // Velocity default: clamped
  private _polarity: boolean = false;         // Velocity default: unipolar
  private _tapSource: number = 0x00;          // SMOOTHED (default)
  private _curveType: number = 0x00;          // LINEAR (default)
  private _curveParam: number = 0;

  constructor(param: IParam) {
    this._paramId = param.paramId;
  }

  base(value: number): this {
    this._base = (value * 65536 / 1000) | 0;  // 0–1000 → Q16.16
    return this;
  }

  amount(value: number): this {
    this._amount = (value * 65536 / 1000) | 0;
    return this;
  }

  smooth(factor: number): this {
    this._smoothFactor = (factor * 16384) | 0; // 14-bit
    return this;
  }

  curve(type: string | [number, number, number, number]): this {
    if (Array.isArray(type)) {
      this._curveType = 0x04;   // LUT
      // LUT index assigned during register() — bridge.allocLut(type)
    } else {
      // Named preset → built-in LUT slot
      switch (type) {
        case 'centered': this._curveType = 0x04; this._curveParam = 1; break;
        case 'diverge':  this._curveType = 0x04; this._curveParam = 2; break;
        // ... etc, mapping to LUT_BUILTIN slots
      }
    }
    return this;
  }

  unipolar(): this { this._polarity = false; return this; }
  bipolar(): this  { this._polarity = true; return this; }
  linear(): this   { this._curveType = 0x00; return this; }
  easeIn(): this   { this._curveType = 0x01; return this; }
  easeOut(): this  { this._curveType = 0x01; this._curveParam = 256; return this; }
  centered(): this { this._curveType = 0x04; this._curveParam = 1; return this; }
  diverge(): this  { this._curveType = 0x04; this._curveParam = 2; return this; }
  converge(): this { this._curveType = 0x04; this._curveParam = 3; return this; }
  symmetric(): this { this._curveType = 0x04; this._curveParam = 4; return this; }
  ducker(): this   { this._curveType = 0x04; this._curveParam = 5; return this; }

  tapSmoothed(): this { this._tapSource = 0x00; return this; }
  tapCurved(): this   { this._tapSource = 0x01; return this; }
  tapRaw(): this      { this._tapSource = 0x02; return this; }
  direct(): this      { return this.tapRaw(); }  // Alias

  /**
   * Pack config into MODULATION_TABLE fields.
   * Called by the bridge when attaching this modulator to a node.
   */
  packConfigA(): number {
    const targetProperty = 0x00; // VELOCITY
    return (targetProperty << 24)
         | (this._tapSource << 16)
         | (this._clamp ? (1 << 15) : 0)
         | (this._polarity ? (1 << 14) : 0)
         | (this._smoothFactor & 0x3FFF);
  }

  packConfigB(): number {
    return (this._curveType << 24) | (this._curveParam & 0x00FFFFFF);
  }

  getParamId(): number { return this._paramId; }
  getBase(): number { return this._base; }
  getAmount(): number { return this._amount; }
}

// Factory method on the Modulator class:
class Modulator {
  static velocity(param: IParam): IVelocityModulator {
    return new VelocityModulatorConfig(param);
  }

  // Other factories follow the same pattern. Only these values differ:
  // Modulator.pitch():  targetProperty=0x01, clamp=false, polarity=true(bipolar)
  // Modulator.volume(): targetProperty=0x05, clamp=true,  polarity=false(unipolar)
  // Modulator.pan():    targetProperty=0x06, clamp=true,  polarity=true(bipolar)
  // Modulator.tempo():  targetProperty=0x03, clamp=true,  polarity=true(bipolar)
  // Modulator.filter(): targetProperty=0x04, clamp=false, polarity=false(unipolar)
  // Modulator.synapseWeight(): targetProperty=0x07, clamp=true, polarity=false(unipolar)
}
```

---

## Appendix C: Sequencer Extraction Map

Line-by-line mapping from `packages/web/src/runtime/processor.ts` to the kernel-side `Sequencer`.

### C.1 Source → Destination

| Source (processor.ts) | Lines | Destination | Notes |
|:---|:---|:---|:---|
| Tempo calculation: `samplesPerTick = ...` | L88–99 | `Sequencer.computeTempo()` | Reads from `PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE` instead of `linker.getBpm()` |
| Node traversal loop: `while (ptr !== NULL_PTR)` | L101–115 | `Sequencer.advance(startTick, endTick, ...)` | Main loop body. Add synapse resolution at chain end |
| `routeNodeEvents()` | L185–234 | `Sequencer.routeNode()` | Extract as method. Add `HAS_MODULATORS` check for lazy eval |
| `normalizeMidi()` | L236–244 | `Sequencer.normalizeMidi()` | Copy unchanged |
| `tickToGateOffset()` | L246–259 | `Sequencer.tickToGateOffset()` | Copy unchanged |
| **New:** Parameter batch evaluation | — | `Sequencer.evaluateParams()` | Section 7.1.1 pseudocode. Runs before traversal |
| **New:** Synapse resolution | — | `Sequencer.resolveSynapses(sourcePtr)` | All-fire model (Section 12A.2) |

### C.2 `Sequencer` Class Skeleton

```typescript
// packages/kernel/src/sequencer.ts [NEW]

import { NODE, NULL_PTR, FLAG, OPCODE, PARAM, PARAM_TABLE, MOD, MOD_TABLE } from './constants';

interface IEventSink {
  noteOn(channelId: number, pitch: number, velocity: number,
         gateOffset: number, expressionId: number): void;
  noteOff(channelId: number, pitch: number, expressionId: number): void;
  controlChange(channelId: number, controller: number, value: number): void;
}

export class Sequencer {
  private readonly sabI32: Int32Array;
  private readonly nodeBuf: Int32Array;         // Pre-allocated, size 16
  private readonly paramInspect: Int32Array;    // Pre-allocated, size 8
  private readonly sink: IEventSink;

  // Copied from processor.ts constants (L28–33)
  private static readonly MIDI_MAX = 127;
  private static readonly SEC_PER_MIN = 60;
  private static readonly OPCODE_SHIFT = 24;
  private static readonly PITCH_SHIFT = 16;
  private static readonly VEL_SHIFT = 8;
  private static readonly BYTE_MASK = 0xFF;

  constructor(sabI32: Int32Array, sink: IEventSink) {
    this.sabI32 = sabI32;
    this.nodeBuf = new Int32Array(16);          // NODE_SIZE_I32
    this.paramInspect = new Int32Array(8);
    this.sink = sink;
  }

  /**
   * Main entry point. Called once per audio block.
   * Source: processor.ts L88–123, refactored.
   */
  advance(
    startTick: number,
    endTick: number,
    frameCount: number,
    sampleRate: number,
    headPtr: number
  ): void {
    // Step 1: Batch parameter evaluation (NEW — Section 7.1.1)
    this.evaluateParams(frameCount, sampleRate);

    // Step 2: Compute tempo from PARAMETER_TABLE (replaces linker.getBpm())
    const samplesPerTick = this.computeTempo(sampleRate);

    // Step 3: Node traversal (from processor.ts L101–115)
    let ptr = headPtr;
    while (ptr !== NULL_PTR) {
      this.readNodeRaw(ptr);
      const nextPtr = this.nodeBuf[NODE.NEXT_PTR];
      this.routeNode(startTick, endTick, frameCount, samplesPerTick);
      ptr = nextPtr;
    }
  }

  /**
   * Parameter batch evaluation.
   * Source: RFC Section 7.1.1 pseudocode (direct transcription).
   */
  private evaluateParams(blockSize: number, sampleRate: number): void {
    // Transcribe Section 7.1.1 pseudocode exactly.
    // Internal source (LFO) generation + curve + smoothing.
  }

  /**
   * Derive samplesPerTick from PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE.
   * Source: processor.ts L91–97, modified to read from PARAM table.
   */
  private computeTempo(sampleRate: number): number {
    // Read tempo from PARAMETER_TABLE instead of linker.getBpm()
    // Convert Q16.16 BPM to samplesPerTick
    // Formula: samplesPerTick = (sampleRate * 60) / (bpm * ppq)
    return 0; // Implementation follows formula from L96
  }

  /**
   * Route events for a single node.
   * Source: processor.ts L185–234 (routeNodeEvents), copied with HAS_MODULATORS check added.
   */
  private routeNode(
    startTick: number,
    endTick: number,
    frameCount: number,
    samplesPerTick: number
  ): void {
    // Exact copy of processor.ts L192–233
    // ADDITION: Before noteOn, check FLAG.HAS_MODULATORS.
    // If set, modulated values are resolved by DSP layer during voice render.
    // Sequencer passes original values; DSP applies modulation lazily.
  }

  /**
   * All-fire synapse resolution.
   * Source: NEW (Section 12A.2).
   * Called when a clip's chain ends.
   */
  private resolveSynapses(sourcePtr: number): void {
    // Hash lookup → chain traversal → fire all with weight > 0
    // Weight scales velocity: effectiveVelocity = original × (weight / 1000)
  }

  // Copied unchanged from processor.ts L236–258:
  private normalizeMidi(value: number): number { /* L236–244 */ return 0; }
  private tickToGateOffset(
    tickDelta: number, frameCount: number, samplesPerTick: number
  ): number { /* L246–259 */ return 0; }

  private readNodeRaw(ptr: number): void {
    // Read 16 i32 values from SAB at ptr offset into this.nodeBuf
  }
}
```

### C.3 What Stays in `processor.ts` After Extraction

```typescript
// packages/web/src/runtime/processor.ts — post-extraction (thin shell)
class SymphonyScriptProcessor extends AudioWorkletProcessor {
  private sequencer!: Sequencer;
  private engine!: Engine;  // implements IEventSink

  public process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output) return true;
    this.clearOutput(output);
    if (!this.isInitialized || !this.isPlaying) return true;

    this.linker.poll();
    const startTick = this.linker.getPlayheadTick();
    const frameCount = output[0]?.length ?? 0;
    const headPtr = this.linker.getHead();

    this.sequencer.advance(startTick, startTick + ticksInBlock, frameCount,
                           this.hostSampleRate, headPtr);

    const rendered = this.engine.render();
    this.copyRenderedBuffer(rendered, output);
    this.linker.setPlayheadTick(endTick);
    return true;
  }

  // clearOutput() and copyRenderedBuffer() stay — they are web-specific (Float32Array I/O)
  // handleMessage() stays — it is web-specific (MessagePort)
}
```

**Key principle:** After extraction, processor.ts has ZERO musical logic. It is only I/O glue: message handling, output clearing, buffer copying. All sequencing, parameter evaluation, and synapse resolution live in `packages/kernel`.

---

## Appendix D: Test Plan

### D.1 Phase 1 — Node Expansion

| Test | Assertion |
|:---|:---|
| `NODE_SIZE_I32 === 16` | Constant check |
| `NODE_SIZE_BYTES === 64` | Constant check |
| Allocate node, verify 16 i32 slots writable | Write/read all slots 0–15 |
| `MOD_LIST_HEAD` default is `NULL_PTR` | Verify slot 8 = 0 after allocation |
| `HAS_MODULATORS` flag unused by default | `PACKED_A & FLAG.HAS_MODULATORS === 0` |
| Existing tests pass with no behavioral changes | Full suite regression |
| `nodeBuf = new Int32Array(16)` everywhere | Grep verify, no `Int32Array(8)` remains |

### D.2 Phase 2 — Stochastic Removal

| Test | Assertion |
|:---|:---|
| `SynapticCursor.ts` does not exist | File system check |
| `SYN_PACK.JITTER_MASK` does not exist | Grep verify |
| `SYN_PACK.JITTER_SHIFT` does not exist | Grep verify |
| `linkTo(target)` accepts no `jitter` param | TypeScript compile check |
| `connect()` / `connectAsync()` accept no `jitter` | TypeScript compile check |
| `WEIGHT_DATA` bits 16–31 are zero | After `connect(src, tgt, 500)`, verify `(weightData >>> 16) === 0` |
| Multiple synapses from same source all fire | Create 3 synapses with weights 800, 500, 300. Verify all 3 targets receive noteOn |
| Synapse with weight 0 does NOT fire | Create synapse with weight 0. Verify target receives no noteOn |
| Weight scales velocity | Weight 500 → velocity = original × 0.5 |

### D.3 Phase 3 — New SAB Tables

| Test | Assertion |
|:---|:---|
| `PARAM_TABLE` offset is after Reverse Index | `getParamTableOffset()` returns correct value |
| `MOD_TABLE` offset is after PARAM_TABLE | `getModTableOffset()` returns correct value |
| `LUT_POOL` offset is after MOD_TABLE | `getLutPoolOffset()` returns correct value |
| `calculateSABSize()` includes all 3 new regions | Size ≥ previous + 32KB + 128KB + 128KB |
| Parameter slot write/read via `Atomics` | Write RAW_VALUE, read back, verify |
| Modulator slot write/read via `Atomics` | Write all 8 fields, read back, verify |
| LUT slot write 256 entries | Write LUT, read entry 0 and 255, verify |
| New HDR fields writable | Write/read PARAM_TABLE_PTR through MOD_ALLOC_HEAD |

### D.4 Phase 4 — Command Protocol

| Test | Assertion |
|:---|:---|
| `CMD.CREATE_MOD` links modulator to node | After command, node `MOD_LIST_HEAD` points to mod |
| `CMD.CREATE_MOD` sets `HAS_MODULATORS` flag | `PACKED_A & FLAG.HAS_MODULATORS !== 0` |
| Multiple mods form linked list | Create 3 mods on same node. Traverse chain, verify all 3 |
| `CMD.DELETE_MOD` unlinks modulator | After delete, chain skips deleted mod |
| Delete last mod clears `HAS_MODULATORS` | Delete all mods on node, verify flag cleared |
| Delete returns mod to free list | After delete, slot is reusable via next CREATE_MOD |

### D.5 Phase 5 — Bridge Integration

| Test | Assertion |
|:---|:---|
| `setParam(id, 750)` writes correct Q16.16 | `Atomics.load` returns `(750 * 65536 / 1000) \| 0 = 49152` |
| `setParam(id, -300)` writes correct bipolar value | `Atomics.load` returns `(-300 * 65536 / 1000) \| 0 = -19661` |
| `createModulator()` returns valid mod offset | Offset is within MOD_TABLE range |
| `createModulator()` when table full returns `BRIDGE_ERR.MOD_TABLE_FULL` | Fill table, verify error on next alloc |
| LUT dedup: same bezier reuses slot | Alloc [0.42,0,0.58,1] twice. Verify same lutIndex, refCount=2 |
| LUT free on last ref: slot reusable | Delete both mods using same LUT. Verify slot freed |
| `inspectParam()` reads all 8 fields | Write known values, inspect, verify buffer matches |
| `inspectMod()` reads all 8 fields | Same |

### D.6 Phase 6 — Sequencer Extraction

| Test | Assertion |
|:---|:---|
| `Sequencer.advance()` fires noteOn for nodes in [start, end) | Same behavior as processor.ts |
| `Sequencer.advance()` fires noteOff at baseTick + duration | Same |
| CC events routed correctly | Same |
| Parameter batch evaluation runs before node traversal | Set param RAW_VALUE, verify SMOOTHED_VALUE updated after advance() |
| LFO parameter generates changing RAW_VALUE | Create LFO param (sine, 4Hz). Call advance() twice. Verify RAW_VALUE differs |
| Tempo modulation changes samplesPerTick | Set TEMPO param to 120 then 180 BPM. Verify different tick-to-sample mapping |
| Synapse resolution: all weight > 0 fire | End-of-clip triggers noteOn on all connected targets |
| processor.ts has zero musical logic | Grep for `routeNodeEvents`, `normalizeMidi` — not found |

### D.7 Phase 7 — Composition API

| Test | Assertion |
|:---|:---|
| `Param.create(0).smooth(0.95)` stores config | Verify PACKED_CFG_A contains smooth factor |
| `Param.create(0).lfo('sine', 4.0)` sets INTERNAL_SOURCE | Verify FLAGS bit 2 set |
| `Param.create(0).bipolar(true)` sets BIPOLAR flag | Verify FLAGS bit 1 set |
| `Param.register(bridge)` writes to PARAMETER_TABLE | All 8 fields written to SAB |
| `Modulator.velocity(param).amount(500).easeIn()` packs correctly | Verify PACKED_CFG_A: targetProperty=0x00, clamp=1, polarity=0 |
| `Modulator.pitch(param).bipolar()` defaults bipolar | Verify PACKED_CFG_A bit 14 = 1 |
| `Modulator.velocity(param).direct()` sets tapSource to RAW | Verify PACKED_CFG_A bits 16–23 = 0x02 |
| Inline cursor: `.velocity(700).mod(Intensity).amount(300)` creates mod entry | After commit, MODULATION_TABLE slot populated |
| Two `.mod()` calls on same property sum deltas | Verify both mods in chain, additive |
| `.linkTo(clip).mod(Scene).base(1000).amount(-1000)` creates SYNAPSE_WEIGHT mod | Verify targetProperty = 0x07 |
| Built-in shapes: `.centered()` uses LUT slot 1 | Verify PACKED_CFG_B = (0x04 << 24) \| 1 |

### D.8 Expr DSL & Derived Parameters

| Test | Assertion |
|:---|:---|
| `Expr.add(paramA, paramB)` produces correct type | `expr.type === 'add'` |
| `Expr.gt(param, 500)` produces correct type | `expr.type === 'gt'`, `expr.threshold === 500` |
| `Expr.and(Expr.gt(a, 500), Expr.lt(b, 300))` nests correctly | `expr.type === 'and'`, children correctly typed |
| `Expr.value(12).compile()` produces Q16.16 | `cfgB` encodes CONST + `(12 * 65536)` |
| Simple expr compiles to single PACKED_CFG_B | `Expr.add(paramA, paramB).compile()` → operator=ADD, srcA, srcB packed |
| Complex nested expr uses LUT_POOL slot | `Expr.add(a, Expr.mul(b, c)).compile()` → COMPLEX flag set, LUT slot index encoded |
| `Param.derive(Expr.add(A, B))` sets FLAGS.DERIVED | Verify FLAGS bit 3 set |
| Derived param RAW_VALUE updated after source change | Set A=500, B=300. After evaluateParams(), derived RAW_VALUE = 800 |
| Derived param respects evaluation order | Derived depends on LFO param. LFO evaluates first, derived reads updated SMOOTHED_VALUE |
| Circular dependency rejected | `Param.derive(Expr.add(self, B))` throws at derive time |
| `.when(Expr.gt(Scene, 500))` gates modulator | Set Scene=400 → delta=0. Set Scene=600 → delta=Amount |
| `.when(Expr.between(S, 200, 800))` range gate | 100→gated, 500→active, 900→gated |
| `.when(Expr.and(a, b))` compound condition | Both must be true for modulator to be active |
| `Expr.toJSON()` is valid JSON | Parse back, reconstruct, verify identical compilation |
| Serializable clip with Expr compiles | `SerializationBridge.materialize(clip.when(Expr.gt(S, 500)))` succeeds |

---

## Appendix E: Fire Trace (Observability)

### E.1 Overview

Two data sources provide full external observability of the deterministic kernel:

1. **Graph Snapshot (Structure)** — node connections, synapse weights, modulator bindings. Changes infrequently (clip creation, linking, live-coding edits). Readable from SAB at any time via node chain and synapse table traversal. Consumer polls at ~1–10Hz for visualization.

2. **Fire Trace Snapshot (Activity)** — which synapses fired most recently, with what effective weights and parameter values. State-based: the audio thread overwrites per-synapse state fields on each fire. The consumer reads these fields on demand at whatever frequency it chooses.

### E.2 Snapshot Model (Primary)

The fire trace is represented as **state** in the SAB, not as a stream of events. The audio thread overwrites per-synapse state fields during synapse resolution. The consumer pulls snapshots on demand via `getFireTraceSnapshot()`.

**Why state over stream:**
- Simpler kernel — no ring buffer management, no overflow handling, no drain obligation on the consumer
- Consumer controls frequency — visualization at 60Hz, training loop after full playback, debugging on-demand
- Fully additive — a ring buffer stream can be added later alongside the snapshot without refactoring

#### E.2.1 Per-Synapse Fire State Fields

The audio thread writes these fields during synapse resolution, alongside existing synapse data:

```typescript
export const SYNAPSE_FIRE = {
  LAST_FIRE_TICK:        0,  // Tick when this synapse last fired (0 = never)
  LAST_EFFECTIVE_WEIGHT: 1,  // Effective weight at last fire (0–1000)
  LAST_EFFECTIVE_PITCH:  2,  // Effective pitch at last fire (Q16.16)
  LAST_EFFECTIVE_VEL:    3,  // Effective velocity at last fire (Q16.16)
  FIRE_COUNT:            4,  // Total fire count since last reset (for analytics/training)
} as const;
```

- `FIRE_COUNT` is reset to 0 by the consumer before a training run. Incremented atomically by the audio thread on each fire.
- `LAST_FIRE_TICK` of 0 means "never fired" — distinguishable from real tick 0 because playback starts at tick ≥ 1.

#### E.2.2 Consumer API

```typescript
// Read graph structure (infrequent changes)
getSynapticSnapshot(outputBuffer: Int32Array): void

// Read fire trace state (frequent changes)
getFireTraceSnapshot(outputBuffer: Int32Array): void

// Reset fire counters before a training run
resetFireCounters(): void
```

Both methods read from SAB using `Atomics.load`. The consumer provides pre-allocated buffers — zero allocation.

#### E.2.3 SPSC Ownership

| Field | Writer | Reader |
|:---|:---|:---|
| `LAST_FIRE_TICK` | Audio engine | Main thread (consumer) |
| `LAST_EFFECTIVE_WEIGHT` | Audio engine | Main thread (consumer) |
| `LAST_EFFECTIVE_PITCH` | Audio engine | Main thread (consumer) |
| `LAST_EFFECTIVE_VEL` | Audio engine | Main thread (consumer) |
| `FIRE_COUNT` | Audio engine (increment) | Main thread (read + reset) |

### E.3 Ring Buffer Stream (Future Extension)

For use cases requiring complete event history (analytics, event replay, detailed logging), a dedicated SPSC `RingBuffer` can be added alongside the snapshot model. The audio thread writes **both** state fields and stream entries:

```typescript
// Snapshot (always):
sab[synapseOffset + LAST_FIRE_TICK] = currentTick
sab[synapseOffset + LAST_EFFECTIVE_WEIGHT] = weight

// Stream (optional, when ring buffer is active):
traceRb.write(traceBuffer)
```

#### E.3.1 Stream Entry Format

```typescript
export const TRACE = {
  TICK:                0,  // Tick at which the event fired
  NODE_PTR:            1,  // Byte offset of the target node
  SYNAPSE_PTR:         2,  // Byte offset of the synapse that fired
  EFFECTIVE_WEIGHT:    3,  // Effective synapse weight after modulation (0–1000)
  EFFECTIVE_PITCH:     4,  // Effective pitch after modulation deltas (Q16.16)
  EFFECTIVE_VELOCITY:  5,  // Effective velocity after modulation deltas (Q16.16)
  EFFECTIVE_DURATION:  6,  // Effective duration after modulation deltas
  RESERVED_7:          7,  // Reserved for future use
} as const;
```

- Stride: 8 × i32 = 32 bytes per entry.
- Same `RingBuffer` primitive used for command communication.
- SPSC: audio thread writes, main thread reads.
- Power-of-2 slot count (e.g., 256 entries). Overflow drops entries, never blocks audio.

The stream extension is purely additive — zero changes to the snapshot model when added.

### E.4 Use Cases

| Consumer | Model Used | Frequency | Purpose |
|:---|:---|:---|:---|
| Neural graph visualization | Graph snapshot + fire snapshot | ~60Hz | Live diagram: glowing connections, weight heatmaps |
| Debugging | Fire snapshot | On-demand | "Why did this note play at pitch 62.3?" |
| Dead path detection | Fire snapshot (`FIRE_COUNT`) | Periodic | "This synapse never fires — dead path" |
| Training loop | Fire snapshot (after playback) | Per-run | Fitness function evaluates fire counts + effective values |
| Complete event replay | Stream (future extension) | Continuous | Full event history for detailed analytics |

### E.5 Design Decisions

| # | Decision | Rationale |
|:---|:---|:---|
| 31 | Snapshot model as primary | Simpler kernel, consumer controls frequency, no overflow handling |
| 32 | Rich state — effective values at fire time | Parameters change continuously; post-hoc reconstruction is inaccurate |
| 33 | `FIRE_COUNT` per synapse | Enables training loop and dead path detection without event stream |
| 34 | Consumer-side interpretation | Kernel writes state. Visualization, debugging, analytics are consumer responsibilities |
| 35 | Graph snapshot via SAB traversal | Structure changes infrequently. No dedicated mechanism needed |
| 36 | Ring buffer stream as future extension | Purely additive alongside snapshot. Deferred until analytics use case demands it |
