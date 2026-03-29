# RFC-070: Modulation Architecture

**Status:** Draft
**Authors:** SymphonyScript Core Team
**Date:** 2026-03-29

---

## 1. Abstract

This RFC specifies the modulation system for SymphonyScript: how external state (game data, MIDI, knobs, sensors) and internal noise (per-node hashing) dynamically influence musical properties (velocity, pitch, timing, volume) at audio-block rate.

The architecture introduces three SAB regions — `PARAMETER_TABLE`, `MODULATION_TABLE`, `LUT_POOL` — plus a `SIGNAL_RING` buffer for kernel-to-engine communication. All modulation state lives in typed arrays using Q16.16 fixed-point. No objects, closures, or strings at audio time.

**Core principle: functions are data.** The kernel has one built-in per-node function (MurmurHash3). Its output is an index into a LUT. The LUT IS the function. Swap the data → swap the behavior. The kernel never runs user code.

### Design Invariants

- **Zero allocation** in hot paths
- **All state in typed arrays** — Rust-portable, no GC
- **SPSC ownership** — Bridge writes, audio thread reads
- **Lock-free updates** — `Atomics.store` for values, ring buffer for structural mutations
- **Deterministic** — same inputs produce identical output across runs and offline export
- **Declarative kernel** — one-way signal emission, no callbacks

---

## 2. Architecture Overview

### 2.1 Three-Layer Separation

```
┌─────────────────────────────────────────────────────┐
│  DSL Layer (Declarative)                            │
│  .threshold()  .probability()  .humanize()          │
│  .jitter()  seed()  lut()  boundary()               │
├─────────────────────────────────────────────────────┤
│  Engine Layer (Imperative)                          │
│  engine.on(signal)                                  │
│  engine.registerParamResolver(...)                  │
│  engine.registerContextResolver(...)                │
│  bridge.setSeed()  bridge.setParam()                │
│  bridge.fillLut()                                   │
├─────────────────────────────────────────────────────┤
│  Kernel (Pure Data Machine)                         │
│  ONE built-in function: murmur3(seed,tick,slot)     │
│  SOURCE=PARAM → reads Parameter Table               │
│  SOURCE=CONTEXT → hash % 256 → reads LUT_POOL      │
│  Writes: Signals (one-way ring buffer)              │
│  Never runs user code                               │
└─────────────────────────────────────────────────────┘
```

**DSL** is fully declarative — cues and data, no imperative logic. **Engine** is where imperative lives — signal handlers, resolvers, bridge writes. **Kernel** is a pure data machine — reads params/LUTs/attributes, writes signals.

### 2.2 Score vs Performer Paradigm

**The SAB (Score)** manages: time, composition, routing, modulation.
**The DSP Layer (Performer)** manages: synthesis, voice allocation, amplitude envelopes, silence detection.

Communication is one-way: kernel fires `noteOn`/`noteOff` → DSP. The DSP never writes back to the SAB. Voice lifetime is managed entirely within the DSP — the kernel has no concept of voices.

### 2.3 Signal Chain

```
PARAMETER_TABLE (per block, batch):
  RAW_VALUE → [Curve] → CURVED_VALUE → [Smooth] → SMOOTHED_VALUE

MODULATION_TABLE (per node, lazy):
  SOURCE=PARAM:   ParamValue → [ModCurve] → [ModSmooth] → Delta
  SOURCE=CONTEXT: LUT[contextId][hashIndex] → [ModCurve] → [ModSmooth] → Delta

Final: Effective = NodeBase + Σ(Deltaᵢ) → [Clamp]
```

---

## 3. Fixed-Point Mathematics

### 3.1 Q16.16 Standard

All modulation values use Q16.16 fixed-point in `i32` slots:

```
1.0  = 65536  (0x00010000)
0.5  = 32768  (0x00008000)
0.0  = 0
-1.0 = -65536
```

**Why:** `Atomics.load/store` don't support `Float32Array`. Q16.16 avoids float rounding and maps directly to Rust integer math.

### 3.2 API Normalization (0–1000)

All parameters accept integer input in 0–1000 range at the API boundary:

| Polarity | API Range | Internal Q16.16 |
|:---|:---|:---|
| Unipolar | `0–1000` | `0–65536` |
| Bipolar | `-1000–1000` | `-65536–65536` |

Bridge converts: `const fixed = (value * 65536 / 1000) | 0;`

**Why 0–1000:** Integer API, no float precision bugs. 1000 steps > 8× MIDI resolution (128). Matches synapse weight range.

### 3.3 Clamping

Per-target-property, applied once at the end of the delta chain:

| Target | Clamp | Range |
|:---|:---|:---|
| Velocity, Volume | Clamped | `[0, 65536]` |
| Pitch, Filter | Unclamped | Full i32 |
| Gate | Implicit | `≤0 = skip` |

### 3.4 Dual-Layer Polarity

Parameter polarity (input domain) and modulator polarity (output direction) are independent:

- **Unipolar param** (Volume: 0–1000) can feed **bipolar mod** (pitch: ±12)
- **Bipolar param** (Swing: ±1000) can feed **unipolar mod** (only adds velocity)

```
// Bipolar remapping after curve:
curvedInput = (curvedInput * 2) - 65536  // [0, 65536] → [-65536, +65536]
```

---

## 4. Source Mode

One flag bit on the modulator: `SOURCE_MODE`.

| Source | Input | Per-node? | Use |
|:---|:---|:---|:---|
| `PARAM` (default) | Parameter Table value | ✗ (global per block) | Standard modulation |
| `CONTEXT` | `LUT_POOL[context_id][hash_index]` | ✓ (per-node) | Noise, humanization, probability |

### 4.1 Hash Function (Built-In)

The kernel's one built-in per-node function. MurmurHash3 finalizer:

```rust
/// Produces a uniform index 0-255 for LUT lookup.
/// Pure integer math — identical in Rust and JS (Math.imul).
fn noise_index(seed: u32, tick: u32, slot: u32) -> u32 {
    let mut h = seed
        ^ tick.wrapping_mul(0x9E3779B9)
        ^ slot.wrapping_mul(0x517CC1B7);
    h ^= h >> 16;
    h = h.wrapping_mul(0x85EBCA6B);
    h ^= h >> 13;
    h = h.wrapping_mul(0xC2B2AE35);
    h ^= h >> 16;
    h % 256
}
```

**Why built-in (not delegated to engine):** Per-node computation requires inline evaluation during traversal. Delegating to the main thread via signals would produce ~150K signals/sec (200 nodes × 375 blocks), overwhelming the ring buffer, and responses would arrive one block late.

### 4.2 Context ID

When `SOURCE=CONTEXT`, the modulator config carries a `context_id` — the LUT slot to read from.

- **Built-in:** `HASH_NOISE` (reserved slot 0, pre-filled with uniform linear ramp at init: `LUT[i] = i * 1000 / 256`)
- **User-defined:** any slot, filled by context resolvers

The kernel treats all context_ids identically: `value = LUT_POOL[context_id][hash_index]`.

### 4.3 Hash + LUT = Any Distribution

Every `SOURCE=CONTEXT` modulator follows the same path — no branching, no special cases:

```
index = murmur3(seed, tick, slot) % 256
value = LUT_POOL[context_id][index]
```

The LUT IS the distribution function. This is inverse transform sampling:

| LUT Contents | Distribution | Use Case |
|:---|:---|:---|
| Linear ramp 0→1000 | Uniform | Default (pre-filled) |
| Gaussian inverse CDF | Gaussian | Natural humanization |
| `[0,0,...,1000,1000]` | Binary step | Hard gate |
| Custom values | Anything | Game data, artistic choice |

**Why always through LUT (no direct hash output):** One code path for all distributions. The "default uniform" is a pre-filled LUT, not a special case. Consistent evaluation, zero branching.

### 4.4 Frozen vs Live Noise

One config bit: `USE_BASE_TICK` vs `USE_PLAYHEAD_TICK` (default).

- **Live (default):** `hash(seed, playhead_tick, slot)` — different each loop iteration
- **Frozen:** `hash(seed, base_tick, slot)` — same per-note personality every loop

### 4.5 Curve Types Compose with Source Mode

No new curve types needed. SOURCE=CONTEXT feeds into existing curves:

| Source | CurveType | Behavior | Use Case |
|:---|:---|:---|:---|
| PARAM | LINEAR | Standard modulation | Volume knob → velocity |
| PARAM | GATE | Binary param gate | Density gating |
| CONTEXT | LINEAR | Continuous per-node noise | Humanization |
| CONTEXT | LUT | Shaped per-node noise | Custom distribution |
| CONTEXT | GATE | Binary per-node gate | Probability |

---

## 5. Activation Gating

**No threshold fields in the attribute plane.** All gating lives in the modulation system.

**Why:** A ghost note needing density rank 800 AND probability 40% requires two different BASE_VALUEs on the same node — impossible with a single attribute field. Modulators carry per-instance BASE_VALUE.

### 5.1 Gate Mechanism

Virtual `GATE` property with implicit base = 1000. Each failing gate modulator adds delta = -1000. If effective ≤ 0, note skipped. Multiple gates AND through additive deltas.

| Gate Type | Modulator Config | Evaluation |
|:---|:---|:---|
| Density | `SOURCE=PARAM, CurveType=GATE, BASE=700` | `param > 700` → pass/fail |
| Probability | `SOURCE=CONTEXT, CurveType=GATE, BASE=400` | `lut_value > 400` → pass/fail |

**Why additive AND-gating:** Density gate fails (delta = -1000) → effective = 0 → skip. Both pass → effective = 1000 → play. Composable, no boolean logic in the kernel.

### 5.2 GATE Curve Evaluation

GATE uses the standard formula — no special path:

```
curvedInput = (inputValue > BASE_VALUE) ? 1 : 0
delta = Amount × curvedInput
```

With `Amount = -1000`: delta = 0 (pass) or -1000 (fail). GATE modulators default to `smoothFactor = 0` (instant, no fade).

---

## 6. Memory Layout

### 6.1 Kernel Structs (Rust)

```rust
/// Per-parameter entry in PARAMETER_TABLE.
/// 8 × i32 = 32 bytes. Capacity: 1024 slots.
#[repr(C, align(32))]
pub struct ParamSlot {
    pub raw_value: i32,       // Bridge-written (Q16.16)
    pub curved_value: i32,    // After spatial curve (audio engine owned)
    pub smoothed_value: i32,  // After temporal smoothing (audio engine owned)
    pub target_value: i32,    // Smoother internal target
    pub packed_cfg_a: u32,    // (CurveType<<24)|(SmoothType<<23)|(SmoothFactor & 0x7FFFFF)
    pub packed_cfg_b: u32,    // External: CurveParam. Internal: (Waveform<<24)|(FreqQ8_24)
    pub flags: u32,           // ACTIVE | BIPOLAR | INTERNAL_SOURCE | DERIVED
    pub phase: u32,           // LFO phase accumulator
}

/// Per-modulator entry in MODULATION_TABLE.
/// 8 × i32 = 32 bytes. Capacity: 4096 slots.
#[repr(C, align(32))]
pub struct ModSlot {
    pub target_ptr: u32,      // Byte offset to target node/synapse
    pub param_id: u32,        // Index into PARAMETER_TABLE (SOURCE=PARAM) or PARAM_NONE sentinel
    pub current_state: i32,   // Modulator's own smoothed value (Q16.16)
    pub base_value: i32,      // Gate threshold or additive window base (Q16.16)
    pub amount_value: i32,    // Maximum delta magnitude (Q16.16)
    pub packed_cfg_a: u32,    // (TargetProperty<<24)|(TapSource<<16)|(Clamp<<15)|
                              // (Polarity<<14)|(SourceMode<<13)|(FrozenTick<<12)|SmoothFactor
    pub packed_cfg_b: u32,    // (CurveType<<24)|(CurveParam/ContextId & 0xFFFFFF)
    pub next_mod_ptr: u32,    // Next modulator in chain (NULL_PTR = end)
}

/// Signal ring buffer entry.
/// 4 × i32 = 16 bytes.
#[repr(C)]
pub struct SignalEntry {
    pub signal_type: u32,     // BOUNDARY type
    pub boundary_id: u32,     // User or implicit boundary ID
    pub tick: u32,            // Playhead tick when signal was emitted
    pub clip_context: u32,    // Clip/traversal context identifier
}
```

### 6.2 ModSlot PACKED_CFG_A Bit Layout

```
Bits 31-24: TargetProperty (8 bits)
  0x00 = VELOCITY       0x04 = FILTER_CUTOFF
  0x01 = PITCH          0x05 = VOLUME
  0x02 = DURATION       0x06 = PAN
  0x03 = TEMPO          0x07 = SYNAPSE_WEIGHT
  0x08 = TICK_OFFSET    0x09 = DETUNE
  0x0F = GATE (virtual)
  0x10-0xFF = Reserved

Bits 23-16: TapSource (8 bits)
  0x00 = SMOOTHED_VALUE (default)
  0x01 = CURVED_VALUE
  0x02 = RAW_VALUE

Bit 15: CLAMP_0_1
Bit 14: MOD_POLARITY (0=unipolar, 1=bipolar)
Bit 13: SOURCE_MODE (0=PARAM, 1=CONTEXT)
Bit 12: USE_BASE_TICK (0=playhead, 1=frozen)

Bits 11-0: SmoothFactor (12 bits)
```

### 6.3 ModSlot PACKED_CFG_B Bit Layout

```
Bits 31-24: CurveType (8 bits)
  0x00 = LINEAR       0x03 = GATE (step function)
  0x01 = QUADRATIC    0x04 = LUT (index in bits 0-23)
  0x02 = STEP

Bits 23-0: CurveParam (24 bits)
  When SOURCE=CONTEXT: context_id (LUT slot for hash-indexed read)
  When CurveType=LUT: LUT slot index for curve shaping
  When CurveType=GATE: threshold (Q16.16 fractional)
```

### 6.4 LUT_POOL

128 slots × 256 entries × i32 = 128 KB.

```rust
/// LUT_POOL: 128 slots of 256 entries each.
/// Slots 0-7 reserved for built-in shapes.
/// Slot 0: UNIFORM (linear ramp, pre-filled at init for HASH_NOISE default).
pub const LUT_SLOT_ENTRIES: usize = 256;
pub const LUT_POOL_SLOTS: usize = 128;
pub const LUT_BUILTIN_COUNT: usize = 8;
```

| Slot | Shape | Use |
|:---|:---|:---|
| 0 | Uniform ramp (0→1000) | Default HASH_NOISE context |
| 1 | Centered (-1→0→+1) | `.centered()` |
| 2 | Diverge V-shape | `.diverge()` |
| 3 | Converge inv-V | `.converge()` |
| 4 | Sine symmetric | `.symmetric()` |
| 5 | Ducker (0→-1) | `.ducker()` |
| 6-7 | Reserved | — |
| 8+ | User LUTs | Custom curves / distributions |

LUT evaluation: `output = LUT_POOL[slot * 256 + index]` — one i32 read. No interpolation (256 steps = <0.4% quantization, inaudible).

### 6.5 Signal Ring Buffer

```rust
/// One-way ring buffer: audio thread writes, main thread reads.
/// Fixed size, power of 2. Overflow drops oldest — audio thread never blocks.
pub const SIGNAL_RING_CAPACITY: usize = 64; // entries
pub const SIGNAL_ENTRY_SIZE: usize = 4;     // i32 per entry
```

- SPSC protocol (same as existing RingBuffer primitive)
- Audio thread writes ~2-4 entries per clip iteration (boundaries)
- Cost per write: ~5ns

### 6.6 Node Attribute Plane

16 × i32 = 64 bytes (one cache line). Shared atomic plane (not triple-buffered):

```rust
#[repr(C, align(64))]
pub struct NodeAttributes {
    pub pitch: i32,           // 0
    pub velocity: i32,        // 1
    pub duration: i32,        // 2
    pub volume: i32,          // 3
    pub channel: i32,         // 4
    pub flags: u32,           // 5
    pub spatial_x: i32,       // 6
    pub spatial_y: i32,       // 7
    pub spatial_z: i32,       // 8
    pub detune: i32,          // 9
    pub tick_offset: i32,     // 10
    pub _reserved: [i32; 5],  // 11-15
}
```

**Flags field (slot 5):**

```
bit 0: HAS_MODULATORS
bit 1: MUTED          — direct skip, no modulation evaluation
bit 2: SOLO           — mute everything else
bit 3: LEGATO_TIE
bit 4: GHOST_NOTE
bits 5-31: reserved
```

No threshold/gate fields. Every field has inherent standalone meaning. All gating lives in the modulation system.

### 6.7 Synapse Attribute Plane

Modulatable synapse fields in shared atomic plane:

```rust
#[repr(C)]
pub struct SynapseAttributes {
    pub weight: i32,          // Velocity multiplier (0-1000). weight > 0 fires.
    pub tick_offset: i32,     // Timing offset. Modulated = jitter.
    pub _reserved: [i32; 2],
}
```

Synapse slots have `MOD_LIST_HEAD` in the structural plane. Gate modulators (density/probability) work on synapses same as nodes.

### 6.8 SAB Memory Map

```
┌───────────────────────────────────────────┬──────────┐
│ Region                                    │ Size     │
├───────────────────────────────────────────┼──────────┤
│ Header                                    │ ~256 B   │
│ Node Heap (4096 × 64B)                    │ 256 KB   │
│ Identity Table                            │ 64 KB    │
│ Symbol Table                              │ 64 KB    │
│ Command Ring Buffer                       │ 1 MB     │
│ Reclaim Ring Buffer                       │ 16 KB    │
│ Synapse Table                             │ 640 KB   │
│ PARAMETER_TABLE (1024 × 32B)              │ 32 KB    │
│ MODULATION_TABLE (4096 × 32B)             │ 128 KB   │
│ LUT_POOL (128 × 1024B)                    │ 128 KB   │
│ SIGNAL_RING (64 × 16B)                    │ 1 KB     │
├───────────────────────────────────────────┼──────────┤
│ TOTAL                                     │ ~2.4 MB  │
└───────────────────────────────────────────┴──────────┘
```

---

## 7. Smoothing

### 7.1 Dual-Layer Design

**Layer 1 — Parameter-level:** Applied once per block during batch pass. Prevents zipper noise on knob turns.

**Layer 2 — Modulator-level:** Applied during lazy evaluation. Per-binding artistic shaping (e.g., slow filter sweep even though param responds quickly).

### 7.2 Types

**Exponential (default):** `smoothed += (target - smoothed) × factor`. One multiply, one add. Natural ease-out. Factor 0.01 = ~2s, 0.1 = ~200ms, 0.5 = ~20ms.

**Linear (opt-in):** `smoothed += clamp(diff, -rate, +rate)`. Constant-rate approach. Deterministic arrival time: `T = distance / rate`. Use: tempo ramps, volume fades.

### 7.3 TapSource Escape Hatch

Each modulator selects which parameter value to read:

| TapSource | Reads | Use |
|:---|:---|:---|
| `SMOOTHED` (0x00) | Fully smoothed | Default |
| `CURVED` (0x01) | Skip smoothing | Raw curve shape |
| `RAW` (0x02) | Bypass all | Direct bridge value |

---

## 8. Evaluation Strategy

### 8.1 Pass 1 — Batch Parameter Update (Start of Block)

Before node traversal (~128 samples at 48kHz):

```rust
for param_id in 0..active_param_count {
    let param = &mut param_table[param_id];
    if !param.flags.contains(ACTIVE) { continue; }

    // Step 0: Internal source (LFO) — generate RAW_VALUE
    if param.flags.contains(INTERNAL_SOURCE) {
        param.raw_value = generate_waveform(param.phase, param.waveform());
        param.phase = param.phase.wrapping_add(phase_increment);
    }

    // Step 1: Spatial curve
    param.curved_value = apply_curve(param.raw_value, param.packed_cfg_a, param.packed_cfg_b);

    // Step 2: Temporal smoothing
    param.smoothed_value = smooth(param.smoothed_value, param.curved_value, param.smooth_factor());
}
```

Cost: O(active_params). Typically 5-50 × 1 multiply = microseconds.

### 8.2 Pass 2 — Lazy Modulator Evaluation (During Traversal/Render)

When a node is reached during traversal:

```rust
if !node.flags.contains(HAS_MODULATORS) { /* use base attributes */ }

let mut gate_effective = 1000; // implicit gate base
let mut velocity_delta: i32 = 0;
let mut pitch_delta: i32 = 0;
// ... other target accumulators

let mut mod_ptr = node.mod_list_head;
while mod_ptr != NULL_PTR {
    let m = &mod_table[mod_ptr];

    // Resolve input value based on SOURCE_MODE
    let input_value = if m.source_mode() == CONTEXT {
        let ctx_id = m.context_id();
        let idx = noise_index(seed, tick, slot) as usize;
        lut_pool[ctx_id * 256 + idx]
    } else {
        let tap = m.tap_source();
        param_table[m.param_id].read(tap)
    };

    // Apply modulator curve
    let curved = apply_mod_curve(input_value, m.packed_cfg_b);

    // Compute delta
    let delta = (m.amount_value as i64 * curved as i64 >> 16) as i32;

    // Accumulate by target property
    match m.target_property() {
        GATE => gate_effective += delta,
        VELOCITY => velocity_delta += delta,
        PITCH => pitch_delta += delta,
        TICK_OFFSET => tick_offset_delta += delta,
        // ... other targets
        _ => {}
    }

    mod_ptr = m.next_mod_ptr;
}

if gate_effective <= 0 { /* skip note entirely */ }
```

Cost: O(polyphony × mods_per_voice). 32 voices × 3 mods = 96 evaluations. Sub-microsecond.

**Why not batch modulators:** A 5-minute track with 10,000 modulated notes would force 10,000 LUT evaluations per block for notes that won't sound for minutes. Lazy evaluation: only active voices traverse their chains — a 300× reduction.

---

## 9. Signal-Based Boundaries

### 9.1 Why Not Callbacks

Boundary callbacks run user code on the audio thread — glitch factories. Signal-based boundaries are fire-and-forget: the kernel emits an event, continues traversal. The engine decides what to do.

### 9.2 BOUNDARY Opcode

```
Kernel traverses → hits BOUNDARY node → writes SignalEntry to ring buffer → continues
```

### 9.3 Implicit Boundaries

DSL inserts automatically:

```
BOUNDARY(CLIP_START) → ... nodes ... → BOUNDARY(CLIP_END)
BOUNDARY(LOOP_START) → ... nodes ... → BOUNDARY(LOOP_END)
```

### 9.4 Custom Boundaries

```typescript
const CHORUS = 0x10
Clip.pipe(boundary(CHORUS), note('G4'))
```

Reserved IDs 0x01–0x0F for implicit. 0x10+ user space. Cost per boundary: ~5ns (one ring buffer write).

---

## 10. Resolvers (Engine-Level)

Two distinct APIs for two distinct storage targets:

### 10.1 Param Resolvers — Global Values → Parameter Table

```typescript
engine.registerParamResolver({
  paramID: GAME_STATE,
  initialValue: 0,
  triggers: [LOOP_START],
  resolver: ctx => gameEngine.getEnemyCount()
})
// Modulator uses: SOURCE=PARAM, paramId=GAME_STATE
```

Engine writes `initialValue` to `PARAMETER_TABLE[paramID]` at init. When triggered, runs resolver, writes result via `bridge.setParam()`.

### 10.2 Context Resolvers — Per-Node Scatter → LUT_POOL

```typescript
engine.registerContextResolver({
  contextID: GAUSSIAN_NOISE,
  initialValue: uniformNoise(256),
  triggers: [LOOP_START],
  resolver: ctx => gaussianNoise(256)
})
// Modulator uses: SOURCE=CONTEXT, contextId=GAUSSIAN_NOISE
```

Engine writes 256-entry `initialValue` to `LUT_POOL[contextID]` at init. When triggered, runs resolver, fills LUT via `bridge.fillLut()`.

### 10.3 Flow

1. Engine writes `initialValue` at init (param or LUT)
2. Kernel hits BOUNDARY → writes signal to ring buffer
3. Engine drains signals → matches triggers → runs resolver → updates param or LUT
4. Next iteration → kernel reads fresh data

### 10.4 Offline Export

```
while (hasMoreBlocks) {
  kernel.advance(block)          // writes signals
  engine.drainSignals()          // runs ALL resolvers synchronously
  writeOutputToFile(block)       // export
}
```

Zero timing imprecision. Deterministic if resolvers are deterministic. Bit-identical across runs.

---

## 11. Humanization & Jitter

Humanization = per-node context modulation targeting specific attributes.

```typescript
// Simple — full depth, uniform distribution
note('G4').humanize(30)
// → SOURCE=CONTEXT, contextId=HASH_NOISE, target=VELOCITY, Amount=30, bipolar

// Custom distribution
note('G4').humanize(30, { distribution: GAUSSIAN_SLOT })
// → SOURCE=CONTEXT, contextId=GAUSSIAN_SLOT, target=VELOCITY, Amount=30
```

Jitter = humanization of tick_offset. No separate field:

```typescript
note('G4').jitter(10)           // SOURCE=CONTEXT, target=TICK_OFFSET, Amount=10
note('G4').jitter(10, 'frozen') // same + USE_BASE_TICK flag
```

---

## 12. Seed & LUT Management

### 12.1 Global Seed

`NOISE_SEED` in SAB header. Default `0`. Writable: `bridge.setSeed(value)`.

### 12.2 Clip-Local Seed — `seed()` Cue

Node opcode in the clip chain. Scoped by clip traversal context (save/restore on enter/leave):

```typescript
Clip.pipe(seed(42), note('G4').probability(70))        // literal
Clip.pipe(seed(PARAM.Entropy), note('G4').probability(70))  // from param
```

No push/pop opcodes — clip traversal naturally scopes.

### 12.3 LUT Cues — `lut()`

One cue, multiple forms:

```typescript
lut(PARAM.LUT_A)                           // select slot from param
lut([PARAM.LUT_A, PARAM.LUT_B]).rotate()   // rotate per iteration
lut(size => customDistribution(size))       // fill from callback (composition-time, size=256)
```

- **Selection**: kernel opcode — sets active LUT index at traversal
- **Fill**: composition-time — DSL evaluates callback, materializes to `Atomics.store()` at init
- **Rotation**: kernel maintains counter in clip context, advances per iteration

---

## 13. Deterministic Synapse Resolution

### 13.1 All-Fire Model

All synapses with effective weight > 0 fire. Weight acts as a **velocity multiplier**, not a probability:

```rust
for synapse in source.outgoing_synapses() {
    let effective_weight = evaluate_synapse_weight(synapse); // includes modulation
    if effective_weight > 0 {
        let velocity_scale = effective_weight as f32 / 1000.0;
        for note in target_clip.notes_in_range(start_tick, end_tick) {
            fire_note_on(note.pitch, note.velocity * velocity_scale);
        }
    }
}
```

**Why:** PRNG-based selection is non-reproducible and incompatible with deterministic modulation. Weight-as-multiplier provides strictly superior control.

### 13.2 Clip-Level Gating via Synapse Weight Modulation

```typescript
parent.linkTo(verseClip)
  .mod(Scene).base(1000).amount(-1000).easeIn()
// Verse fades out as Scene rises. At Scene=1000, weight=0 → entire clip skipped.
```

Crossfade = opposing weight modulators on parallel synapses:

```typescript
parent.linkTo(verseClip).mod(Scene).base(1000).amount(-1000)   // 1000→0
parent.linkTo(chorusClip).mod(Scene).base(0).amount(1000)       // 0→1000
```

Not a primitive — a composition pattern. No crossfade-specific code.

---

## 14. Multi-Modulator Combination

### 14.1 Additive Delta Summation

```
Effective = NodeOriginalValue + Σ(Amount_i × CurvedInput_i)
```

**Why additive:** Matches hardware modular synth CV mixing. Multiplicative spirals out of control. Last-write-wins kills complex sound design. Addition is commutative — no order dependence.

### 14.2 Clamping

Applied once at the end of the chain, after all deltas are summed.

---

## 15. Command Protocol

### 15.1 Opcodes

```rust
pub const CMD_CREATE_MOD: u32 = 7;  // Create and link a modulator
pub const CMD_DELETE_MOD: u32 = 8;  // Unlink and free a modulator
```

### 15.2 CREATE_MOD

Payload: `[CMD_CREATE_MOD, NodePtr, ModulatorPtr, 0]`

1. Bridge pre-writes all config fields to `MODULATION_TABLE[ModulatorPtr]` via `Atomics.store`
2. Bridge enqueues command via Ring Buffer
3. Worker links modulator into node's `MOD_LIST_HEAD` chain, sets `HAS_MODULATORS` flag

### 15.3 DELETE_MOD

Payload: `[CMD_DELETE_MOD, NodePtr, ModulatorPtr, 0]`

Worker unlinks from chain, returns slot to free list. If chain empty, clears `HAS_MODULATORS`.

### 15.4 Direct Updates (No Command Needed)

| Operation | Method |
|:---|:---|
| `setParam(id, value)` | `Atomics.store` to `RAW_VALUE` |
| Update `AMOUNT_VALUE` | `Atomics.store` to mod field |
| Update `PACKED_CFG_A/B` | `Atomics.store` to mod field |

SPSC-safe: Bridge is sole writer, audio engine is sole reader.

---

## 16. Composition API

### 16.1 Parameter Creation

```typescript
const Intensity = Param.create(PARAM.Intensity)
  .smooth(0.95)
  .curve('easeIn')
  .bipolar(false);

const Vibrato = Param.create(PARAM.Vibrato)
  .lfo('sine', 4.0)
  .bipolar(true);
```

### 16.2 Modulator Factories

```typescript
// Reusable
const intensityVel = Modulator.velocity(Intensity).base(700).amount(300).easeIn();

// Inline cursor
Clip.melody()
  .note('C4')
  .velocity(700)
    .mod(Intensity).amount(300).easeIn()
    .mod(CrowdEnergy).amount(100).linear()
  .note('E4')
```

### 16.3 Gating DSL

```typescript
note('G4')
  .threshold(700, Density)    // GATE: SOURCE=PARAM, BASE=700
  .probability(40)            // GATE: SOURCE=CONTEXT, BASE=400
```

### 16.4 Runtime Updates

```typescript
bridge.setParam(PARAM.Intensity, 750);   // 75%
bridge.setParam(PARAM.Swing, -300);      // 30% behind beat
```

---

## 17. LFO as Internal Parameter Source

When `FLAGS.INTERNAL_SOURCE` is set, the audio engine generates `RAW_VALUE` each block:

```rust
pub fn generate_waveform(phase: u32, waveform: u8) -> i32 {
    let norm = (phase >> 16) & 0xFFFF; // 0-65535
    match waveform {
        SINE => {
            let x = norm as i32 - 32768;
            let x = (x * 201) >> 6;          // scale to ±π in Q16.16
            let x2 = (x * x) >> 16;
            let x3 = (x2 * x) >> 16;
            let x5 = (x3 * x2) >> 16;
            x - ((x3 * 10923) >> 16) + ((x5 * 546) >> 16)
        }
        TRIANGLE => { /* linear ramp up/down */ }
        SQUARE   => if norm < 32768 { 65536 } else { -65536 },
        SAW      => (norm as i32 * 2) - 65536,
        _ => 0,
    }
}
```

Same signal chain: `generate RAW_VALUE → curve → smooth → modulators read SMOOTHED_VALUE`.

---

## 18. Expression DSL (`Expr`)

Unified expression system for derived parameter values and conditional routing. Data structures, not closures — serializable and kernel-compilable.

### 18.1 Arithmetic Operators

```typescript
Expr.add(a, b)    Expr.sub(a, b)    Expr.mul(a, b)
Expr.lerp(a, b, t)  Expr.scale(a, factor)  Expr.clamp(a, lo, hi)
```

### 18.2 Derived Parameters

```typescript
const FinalPitch = Param.derive(Expr.add(BasePitch, Expr.mul(Scene, Expr.value(12))));
```

`FLAGS.DERIVED` bit set. RAW_VALUE computed from source params' SMOOTHED_VALUE. Two-pass evaluation (sources first, derived second). Circular dependencies rejected at composition time.

### 18.3 Conditional Routing

```typescript
parent.linkTo(verseClip)
  .mod(Scene).base(1000).amount(-1000)
  .when(Expr.gt(Scene, 500));   // Only active when Scene > 500
```

`.when()` gates the modulator's delta to 0 when the condition is false.

---

## 19. Fire Trace (Observability)

### 19.1 Snapshot Model

Fire trace is SAB **state**, not a stream. Audio thread overwrites per-synapse fields during resolution. Consumer pulls snapshots on demand.

```rust
pub struct SynapseFireState {
    pub last_fire_tick: u32,
    pub last_effective_weight: i32,
    pub last_effective_pitch: i32,
    pub last_effective_velocity: i32,
    pub fire_count: u32,
}
```

Consumer API: `getFireTraceSnapshot(buffer)`, `resetFireCounters()`. Zero allocation.

### 19.2 Ring Buffer Stream (Future Extension)

Additive — a dedicated SPSC ring buffer can be added alongside snapshots for event history, analytics, or replay. Writing both state fields and stream entries:

```rust
// Snapshot (always):
synapse.last_fire_tick = current_tick;
// Stream (optional):
trace_ring.write(&trace_entry);
```

---

## 20. Mechanical Specifications

### 20.1 Modulator Allocator

Free-list mirroring node allocation. `HDR.MOD_ALLOC_HEAD` → linked chain of free slots. Pop on CREATE_MOD, push on DELETE_MOD.

### 20.2 Error Handling

`BRIDGE_ERR.MOD_TABLE_FULL`, `BRIDGE_ERR.LUT_POOL_FULL`. Bridge-side only — audio thread never allocates.

### 20.3 Parameter Deregistration

`FLAGS.ACTIVE = 0`. Modulators read frozen `SMOOTHED_VALUE`. No auto-cleanup. If slot reused, existing modulators seamlessly read new parameter.

### 20.4 PARAM_NONE Sentinel

When a CONTEXT modulator has no controlling param (e.g., simple `.humanize(30)`), `param_id = 0xFFFF` (PARAM_NONE). Depth is treated as fixed (full depth = 1000).

### 20.5 Tempo Modulation

Sequencer reads `PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE` at block start, derives `samples_per_tick`. Constant within block. Industry standard (Ableton, Logic, Cubase all update tempo per buffer).

### 20.6 LUT Deduplication

Bridge-side: `lutHashes[128]` + `lutRefCounts[128]` + free-list. Hash control points → dedup check → reuse or claim. Ref-counted. LUT data written before `CMD.CREATE_MOD` is enqueued.

---

## Appendix A: Decision Log

| # | Decision | Rationale |
|:---|:---|:---|
| 1 | Q16.16 fixed-point | `Atomics` doesn't support Float32; Rust-portable |
| 2 | SOURCE_MODE: PARAM vs CONTEXT | One bit. PARAM=global, CONTEXT=per-node via hash+LUT |
| 3 | Hash always through LUT | One code path, no branching. "Default" is a pre-filled LUT |
| 4 | Functions are data (LUT) | Swap distribution by swapping LUT contents. Kernel doesn't know gaussian from binary |
| 5 | No threshold attributes | Ghost-note argument: multiple gates need multiple BASE_VALUEs |
| 6 | Gate via additive deltas | AND-gating without boolean logic. Failing gate = -1000 delta |
| 7 | Signal ring buffer (not callbacks) | Kernel never runs user code. Audio thread never blocks |
| 8 | Context resolvers fill LUTs | Custom distributions via engine, not kernel. Zero audio-thread complexity |
| 9 | Param resolvers for global values | Trigger-based param updates. Same pattern as context resolvers |
| 10 | BOUNDARY opcode | Kernel emits signals at structural points. ~5ns per write |
| 11 | Deterministic all-fire synapses | No PRNG. Weight = velocity multiplier. Reproducible |
| 12 | Dual-layer smoothing + TapSource | Parameter-level + modulator-level + escape hatch |
| 13 | Hybrid evaluation (batch + lazy) | O(params + polyphony), not O(total_mods) |
| 14 | Additive delta combination | Commutative, matches modular synth CV mixing |
| 15 | Crossfade as composition pattern | Not a primitive — opposing weight mods on same param |
| 16 | tick_offset + CONTEXT = jitter | No separate jitter field or PRNG |
| 17 | LFO as internal param source | Same signal chain. Audio engine generates RAW_VALUE |
| 18 | Expr DSL for derived params | Data structures, serializable, kernel-compilable |
| 19 | 0-1000 normalized API input | Integer, no float bugs, 8× MIDI resolution |
| 20 | Overflow drops oldest signal | Audio thread health > stale events |
| 21 | Frozen vs live noise bit | USE_BASE_TICK for repeating per-note personality |
| 22 | Clip-scoped seed cue | seed() scopes naturally with traversal context |
| 23 | lut() cue unification | select/rotate/fill in one cue, kernel sees one opcode |

## Appendix B: What Was Rejected

| Concept | Why |
|:---|:---|
| Threshold/probability as attribute fields | Multiple gates need multiple BASE_VALUEs on same node |
| Separate NOISE_HASH/NOISE_HASH_GATE curve types | SOURCE_MODE + existing curves compose the same behavior |
| Hash direct output (no LUT) | Inconsistent — always through LUT gives one code path |
| Boundaries as callbacks | Imperative, breaks declarative DSL |
| Two-way audio↔main channel | Non-deterministic in live, per-node throughput too high |
| PRE_NODE/POST_NODE signals | 150K signals/sec overflows ring buffer |
| Cue composition/factories | HOC-like abstraction; hides details at scale |
| Param.dynamic() | Deferred — manual setParam() + resolvers suffice |
| Stochastic synapse selection | Non-reproducible. Deterministic weights + external learning is better |
| PRNG in kernel | Non-reproducible, stateful. Hash is stateless and deterministic |
