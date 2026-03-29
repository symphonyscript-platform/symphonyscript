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

### 2.4 Concurrency Model

| Writer | Reader | Mechanism |
|:---|:---|:---|
| Bridge → `PARAMETER_TABLE.RAW_VALUE` | Audio engine | `Atomics.store` (SPSC, lock-free) |
| Bridge → Modulator config fields | Audio engine | `Atomics.store` (SPSC, lock-free) |
| Bridge → `LUT_POOL` data | Audio engine | `Atomics.store` (bulk write before link) |
| Bridge → `MOD_LIST_HEAD` chain | Audio engine | `CMD.CREATE_MOD` / `CMD.DELETE_MOD` via Ring Buffer |
| Audio engine → `PARAMETER_TABLE.SMOOTHED_VALUE` | DSP voices | Single-writer (audio engine only) |
| Audio engine → `SIGNAL_RING` | Engine (main thread) | SPSC ring buffer, overflow drops oldest |
| Audio engine → `SynapseFireView` fields | Main thread (consumer) | Single-writer (audio engine only) |

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

### 6.1 SAB View Types

All kernel data lives in the SAB (`Arc<[AtomicI32]>`). Views are zero-cost typed wrappers — they hold `(sab, start_index)` and provide domain-specific accessors. No values are stored in the view itself.

```rust
/// Per-parameter view into PARAMETER_TABLE.
/// 8 × i32 = 32 bytes per slot. Capacity: 1024 slots.
pub struct ParamView {
    sab: SAB,
    start_index: usize,
}

impl ParamView {
    // Slot 0: RAW_VALUE — Bridge-written (Q16.16)
    pub fn raw_value(&self) -> i32 { self.read(0) }
    pub fn set_raw_value(&self, v: i32) { self.write(0, v) }

    // Slot 1: CURVED_VALUE — After spatial curve (audio engine owned)
    pub fn curved_value(&self) -> i32 { self.read(1) }
    pub fn set_curved_value(&self, v: i32) { self.write(1, v) }

    // Slot 2: SMOOTHED_VALUE — After temporal smoothing (audio engine owned)
    pub fn smoothed_value(&self) -> i32 { self.read(2) }
    pub fn set_smoothed_value(&self, v: i32) { self.write(2, v) }

    // Slot 3: TARGET_VALUE — Smoother internal target
    pub fn target_value(&self) -> i32 { self.read(3) }
    pub fn set_target_value(&self, v: i32) { self.write(3, v) }

    // Slot 4: PACKED_CFG_A — (CurveType<<24)|(SmoothType<<23)|(SmoothFactor & 0x7FFFFF)
    pub fn curve_type(&self) -> u8 { (self.read(4) >> 24) as u8 }
    pub fn smooth_type(&self) -> u8 { ((self.read(4) >> 23) & 1) as u8 }
    pub fn smooth_factor(&self) -> i32 { self.read(4) & 0x7FFFFF }
    pub fn set_packed_cfg_a(&self, v: u32) { self.write(4, v as i32) }

    // Slot 5: PACKED_CFG_B — External: CurveParam. Internal: (Waveform<<24)|(FreqQ8_24)
    pub fn waveform(&self) -> u8 { (self.read(5) >> 24) as u8 }
    pub fn freq_q8_24(&self) -> u32 { (self.read(5) & 0xFFFFFF) as u32 }
    pub fn set_packed_cfg_b(&self, v: u32) { self.write(5, v as i32) }

    // Slot 6: FLAGS — Bit 0: ACTIVE | Bit 1: BIPOLAR | Bit 2: INTERNAL_SOURCE | Bit 3: DERIVED
    pub fn is_active(&self) -> bool { self.read(6) & 1 != 0 }
    pub fn is_bipolar(&self) -> bool { self.read(6) & 2 != 0 }
    pub fn is_internal_source(&self) -> bool { self.read(6) & 4 != 0 }
    pub fn is_derived(&self) -> bool { self.read(6) & 8 != 0 }
    pub fn set_flags(&self, v: u32) { self.write(6, v as i32) }

    // Slot 7: PHASE — LFO phase accumulator
    pub fn phase(&self) -> u32 { self.read(7) as u32 }
    pub fn set_phase(&self, v: u32) { self.write(7, v as i32) }

    fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
    fn write(&self, offset: usize, v: i32) {
        self.sab[self.start_index + offset].store(v, Ordering::Relaxed)
    }
}

/// Per-modulator view into MODULATION_TABLE.
/// 8 × i32 = 32 bytes per slot. Capacity: 4096 slots.
pub struct ModView {
    sab: SAB,
    start_index: usize,
}

impl ModView {
    // Slot 0: TARGET_PTR — Byte offset to target node/synapse
    pub fn target_ptr(&self) -> u32 { self.read(0) as u32 }
    pub fn set_target_ptr(&self, v: u32) { self.write(0, v as i32) }

    // Slot 1: PARAM_ID — Index into PARAMETER_TABLE (SOURCE=PARAM) or PARAM_NONE sentinel
    pub fn param_id(&self) -> u32 { self.read(1) as u32 }
    pub fn set_param_id(&self, v: u32) { self.write(1, v as i32) }

    // Slot 2: CURRENT_STATE — Modulator's own smoothed value (Q16.16)
    pub fn current_state(&self) -> i32 { self.read(2) }
    pub fn set_current_state(&self, v: i32) { self.write(2, v) }

    // Slot 3: BASE_VALUE — Gate threshold or additive window base (Q16.16)
    pub fn base_value(&self) -> i32 { self.read(3) }
    pub fn set_base_value(&self, v: i32) { self.write(3, v) }

    // Slot 4: AMOUNT_VALUE — Maximum delta magnitude (Q16.16)
    pub fn amount_value(&self) -> i32 { self.read(4) }
    pub fn set_amount_value(&self, v: i32) { self.write(4, v) }

    // Slot 5: PACKED_CFG_A — (TargetProperty<<24)|(TapSource<<16)|(Clamp<<15)|
    //                        (Polarity<<14)|(SourceMode<<13)|(FrozenTick<<12)|SmoothFactor
    pub fn target_property(&self) -> u8 { (self.read(5) >> 24) as u8 }
    pub fn tap_source(&self) -> u8 { ((self.read(5) >> 16) & 0xFF) as u8 }
    pub fn source_mode(&self) -> u8 { ((self.read(5) >> 13) & 1) as u8 }
    pub fn is_frozen(&self) -> bool { self.read(5) & (1 << 12) != 0 }
    pub fn is_bipolar(&self) -> bool { self.read(5) & (1 << 14) != 0 }
    pub fn smooth_factor(&self) -> i32 { self.read(5) & 0xFFF }
    pub fn set_packed_cfg_a(&self, v: u32) { self.write(5, v as i32) }

    // Slot 6: PACKED_CFG_B — (CurveType<<24)|(CurveParam/ContextId & 0xFFFFFF)
    pub fn curve_type(&self) -> u8 { (self.read(6) >> 24) as u8 }
    pub fn context_id(&self) -> u32 { (self.read(6) & 0xFFFFFF) as u32 }
    pub fn set_packed_cfg_b(&self, v: u32) { self.write(6, v as i32) }

    // Slot 7: NEXT_MOD_PTR — Next modulator in chain (NULL_PTR = end)
    pub fn next_mod_ptr(&self) -> u32 { self.read(7) as u32 }
    pub fn set_next_mod_ptr(&self, v: u32) { self.write(7, v as i32) }

    fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
    fn write(&self, offset: usize, v: i32) {
        self.sab[self.start_index + offset].store(v, Ordering::Relaxed)
    }
}

/// Signal ring buffer entry layout.
/// 4 × i32 = 16 bytes per entry.
///
/// Slot 0: signal_type   — BOUNDARY type
/// Slot 1: boundary_id   — User or implicit boundary ID
/// Slot 2: tick           — Playhead tick when signal was emitted
/// Slot 3: clip_context   — Clip/traversal context identifier
pub const SIGNAL_ENTRY_SLOTS: usize = 4;
```

### 6.2 ParamSlot Bit Layouts

**PACKED_CFG_A:**

```
Bits 31-24: CurveType (8 bits)
  0x00 = LINEAR       0x03 = GATE
  0x01 = QUADRATIC    0x04 = LUT
  0x02 = STEP

Bit 23: SmoothType (0=exponential, 1=linear)

Bits 22-0: SmoothFactor (23 bits, Q16.16 fractional)
```

**FLAGS:**

```
Bit 0: ACTIVE          — included in batch pass
Bit 1: BIPOLAR         — maps output [-65536, +65536] instead of [0, 65536]
Bit 2: INTERNAL_SOURCE — audio engine generates RAW_VALUE (LFO)
Bit 3: DERIVED         — RAW_VALUE computed from Expr, two-pass evaluation
Bits 4-31: reserved
```

### 6.3 ModView PACKED_CFG_A Bit Layout

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

### 6.4 ModView PACKED_CFG_B Bit Layout

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

### 6.5 LUT_POOL

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

### 6.6 Signal Ring Buffer

```rust
/// One-way ring buffer: audio thread writes, main thread reads.
/// Fixed size, power of 2. Overflow drops oldest — audio thread never blocks.
pub const SIGNAL_RING_CAPACITY: usize = 64; // entries
pub const SIGNAL_ENTRY_SIZE: usize = 4;     // i32 per entry
```

- SPSC protocol (same as existing RingBuffer primitive)
- Audio thread writes ~2-4 entries per clip iteration (boundaries)
- Cost per write: ~5ns

### 6.7 Node Attribute Plane

16 × i32 = 64 bytes (one cache line). Shared atomic plane (not triple-buffered):

```rust
/// Zero-cost view over node attribute slots in the SAB.
pub struct NodeAttributesView {
    sab: SAB,
    start_index: usize,
}

impl NodeAttributesView {
    pub fn pitch(&self) -> i32 { self.read(0) }
    pub fn set_pitch(&self, v: i32) { self.write(0, v) }
    pub fn velocity(&self) -> i32 { self.read(1) }
    pub fn set_velocity(&self, v: i32) { self.write(1, v) }
    pub fn duration(&self) -> i32 { self.read(2) }
    pub fn set_duration(&self, v: i32) { self.write(2, v) }
    pub fn volume(&self) -> i32 { self.read(3) }
    pub fn set_volume(&self, v: i32) { self.write(3, v) }
    // Slot 4: reserved (instrument routing is handled by synapses, not attributes)
    pub fn flags(&self) -> u32 { self.read(5) as u32 }
    pub fn set_flags(&self, v: u32) { self.write(5, v as i32) }
    pub fn spatial_x(&self) -> i32 { self.read(6) }
    pub fn set_spatial_x(&self, v: i32) { self.write(6, v) }
    pub fn spatial_y(&self) -> i32 { self.read(7) }
    pub fn set_spatial_y(&self, v: i32) { self.write(7, v) }
    pub fn spatial_z(&self) -> i32 { self.read(8) }
    pub fn set_spatial_z(&self, v: i32) { self.write(8, v) }
    pub fn detune(&self) -> i32 { self.read(9) }
    pub fn set_detune(&self, v: i32) { self.write(9, v) }
    pub fn tick_offset(&self) -> i32 { self.read(10) }
    pub fn set_tick_offset(&self, v: i32) { self.write(10, v) }
    // Slots 11-15: reserved

    pub fn is_muted(&self) -> bool { self.flags() & 1 != 0 }
    pub fn is_solo(&self) -> bool { self.flags() & 2 != 0 }

    fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
    fn write(&self, offset: usize, v: i32) {
        self.sab[self.start_index + offset].store(v, Ordering::Relaxed)
    }
}
```

**Flags field (slot 5):**

```
bit 0: MUTED          — direct skip, no modulation evaluation
bit 1: SOLO           — mute everything else
bits 2-31: reserved
```

LEGATO_TIE lives in the structural plane (sequencer control flow: suppress noteOn, extend noteOff). GHOST_NOTE is a DSL-level expression (compiles to velocity modification). Neither is a kernel attribute.

No threshold/gate fields. Every field has inherent standalone meaning. All gating lives in the modulation system.

### 6.8 Synapse Attribute Plane

Modulatable synapse fields in shared atomic plane:

```rust
/// Zero-cost view over synapse attribute slots in the SAB.
pub struct SynapseAttributesView {
    sab: SAB,
    start_index: usize,
}

impl SynapseAttributesView {
    // Slot 0: weight — Velocity multiplier (0-1000). weight > 0 fires.
    pub fn weight(&self) -> i32 { self.read(0) }
    pub fn set_weight(&self, v: i32) { self.write(0, v) }

    // Slot 1: tick_offset — Timing offset. Modulated = jitter.
    pub fn tick_offset(&self) -> i32 { self.read(1) }
    pub fn set_tick_offset(&self, v: i32) { self.write(1, v) }

    // Slots 2-3: reserved

    fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
    fn write(&self, offset: usize, v: i32) {
        self.sab[self.start_index + offset].store(v, Ordering::Relaxed)
    }
}
```

Synapse slots have `MOD_LIST_HEAD` in the structural plane. Gate modulators (density/probability) work on synapses same as nodes.

### 6.9 SAB Memory Map

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

### 6.10 Header Fields

```rust
/// New header indices (appended after existing header fields).
pub const HDR_PARAM_TABLE_PTR: usize = 46;       // Byte offset to PARAMETER_TABLE
pub const HDR_PARAM_TABLE_CAPACITY: usize = 47;   // Number of parameter slots (default: 1024)
pub const HDR_MOD_TABLE_PTR: usize = 48;           // Byte offset to MODULATION_TABLE
pub const HDR_MOD_TABLE_CAPACITY: usize = 49;      // Number of modulator slots (default: 4096)
pub const HDR_LUT_POOL_PTR: usize = 50;            // Byte offset to LUT_POOL
pub const HDR_LUT_POOL_CAPACITY: usize = 51;       // Number of LUT slots (default: 128)
pub const HDR_ACTIVE_PARAM_COUNT: usize = 52;      // [ATOMIC] Active parameters for batch loop
pub const HDR_MOD_ALLOC_HEAD: usize = 53;          // Modulator free-list head
pub const HDR_SIGNAL_RING_PTR: usize = 54;         // Byte offset to SIGNAL_RING
pub const HDR_NOISE_SEED: usize = 55;              // Global noise seed (default: 0)
```

### 6.11 SAB Offset Calculation

```rust
pub fn param_table_offset(
    node_capacity: usize,
    synapse_capacity: usize,
) -> usize {
    reverse_index_offset(node_capacity, synapse_capacity)
        + REVERSE_INDEX_BUCKET_COUNT * 4
}

pub fn mod_table_offset(
    node_capacity: usize,
    synapse_capacity: usize,
    param_capacity: usize,
) -> usize {
    param_table_offset(node_capacity, synapse_capacity)
        + param_capacity * PARAM_STRIDE_BYTES
}

pub fn lut_pool_offset(
    node_capacity: usize,
    synapse_capacity: usize,
    param_capacity: usize,
    mod_capacity: usize,
) -> usize {
    mod_table_offset(node_capacity, synapse_capacity, param_capacity)
        + mod_capacity * MOD_STRIDE_BYTES
}

pub fn signal_ring_offset(
    node_capacity: usize,
    synapse_capacity: usize,
    param_capacity: usize,
    mod_capacity: usize,
    lut_slots: usize,
) -> usize {
    lut_pool_offset(node_capacity, synapse_capacity, param_capacity, mod_capacity)
        + lut_slots * LUT_SLOT_ENTRIES * 4
}
```

### 6.12 SPSC Ownership

**Parameter Table:**

| Field | Writer | Reader |
|:---|:---|:---|
| `raw_value` | Bridge (main thread) | Audio engine |
| `curved_value` | Audio engine | DSP voices |
| `smoothed_value` | Audio engine | DSP voices |
| `target_value` | Audio engine | Audio engine (internal) |
| `packed_cfg_a/b` | Bridge (at init or reconfigure) | Audio engine |
| `flags` | Bridge | Audio engine |
| `phase` | Audio engine | Audio engine (internal) |

**Modulation Table:**

| Field | Writer | Reader |
|:---|:---|:---|
| `target_ptr`, `param_id` | Bridge (at creation) | Audio engine |
| `packed_cfg_a/b` | Bridge (at creation or reconfigure) | Audio engine |
| `base_value`, `amount_value` | Bridge (live-updatable) | Audio engine |
| `current_state` | Audio engine | Audio engine (internal) |
| `next_mod_ptr` | Audio engine (during CMD processing) | Audio engine |

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
    let param = ParamView::new(sab.clone(), param_table_base + param_id * 8);
    if !param.is_active() { continue; }

    // Step 0: Internal source (LFO) — generate RAW_VALUE
    if param.is_internal_source() {
        param.set_raw_value(generate_waveform(param.phase(), param.waveform()));
        param.set_phase(param.phase().wrapping_add(phase_increment));
    }

    // Step 1: Spatial curve
    param.set_curved_value(apply_curve(param.raw_value(), param.curve_type()));

    // Step 2: Temporal smoothing
    param.set_smoothed_value(smooth(param.smoothed_value(), param.curved_value(), param.smooth_factor()));
}
```

Cost: O(active_params). Typically 5-50 × 1 multiply = microseconds.

### 8.2 Pass 2 — Lazy Modulator Evaluation (During Traversal/Render)

When a node is reached during traversal:

```rust
let node = NodeView::new(sab.clone(), node_offset); // structural plane view
if node.mod_list_head() == NULL_PTR { /* use base attributes directly */ }

let mut gate_effective: i32 = 1000; // implicit gate base
let mut velocity_delta: i32 = 0;
let mut pitch_delta: i32 = 0;
// ... other target accumulators

let mut mod_ptr = node.mod_list_head();
while mod_ptr != NULL_PTR {
    let m = ModView::new(sab.clone(), mod_table_base + mod_ptr as usize * 8);

    // Resolve input value based on SOURCE_MODE
    let input_value = if m.source_mode() == CONTEXT {
        let ctx_id = m.context_id() as usize;
        let idx = noise_index(seed, tick, slot) as usize;
        lut_pool_read(sab, lut_base + ctx_id * 256 + idx)
    } else {
        let tap = m.tap_source();
        let p = ParamView::new(sab.clone(), param_table_base + m.param_id() as usize * 8);
        match tap {
            RAW => p.raw_value(),
            CURVED => p.curved_value(),
            _ => p.smoothed_value(),
        }
    };

    // Apply modulator curve
    let curved = apply_mod_curve(input_value, m.packed_cfg_b);

    // Compute delta (pure integer, Q16.16)
    let delta = ((m.amount_value() as i64 * curved as i64) >> 16) as i32;

    // Accumulate by target property
    match m.target_property() {
        GATE => gate_effective += delta,
        VELOCITY => velocity_delta += delta,
        PITCH => pitch_delta += delta,
        TICK_OFFSET => tick_offset_delta += delta,
        // ... other targets
        _ => {}
    }

    mod_ptr = m.next_mod_ptr();
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
    let syn_attrs = SynapseAttributesView::new(sab.clone(), synapse.attr_offset());
    let effective_weight = evaluate_synapse_weight(syn_attrs); // includes modulation
    if effective_weight > 0 {
        // Pure integer: weight 0-1000 acts as velocity scaler
        for note in target_clip.notes_in_range(start_tick, end_tick) {
            let scaled_velocity = (note.velocity * effective_weight) / 1000;
            fire_note_on(note.pitch, scaled_velocity);
        }
    }
}
```

**Why:** PRNG-based selection is non-reproducible and incompatible with deterministic modulation. Weight-as-multiplier provides strictly superior control.

### 13.2 Synapse Table Field Changes

`WEIGHT_DATA` (offset +2) in the synapse table:

| Before | After |
|:---|:---|
| `weight(16b) \| jitter(16b)` | `weight(16b) \| reserved(16b)` |

The jitter field (bits 16–31) is zeroed and reserved. Jitter is now handled by `tick_offset` modulation via `SOURCE=CONTEXT` in the `SynapseAttributePlane`.

### 13.3 API Changes

| Method | Before | After |
|:---|:---|:---|
| `linkTo()` | `linkTo(target, weight?, jitter?)` | `linkTo(target, weight?)` |
| `connect()` | `connect(srcId, tgtId, weight?, jitter?)` | `connect(srcId, tgtId, weight?)` |

All PRNG state (`nextRandom()`, `prngState`, `setSeed()` on the old `SynapticCursor`) is deleted. The `SynapticCursor` class is deleted entirely — its surviving logic (hash lookup, chain traversal, quota enforcement) folds into the kernel-side sequencer.

### 13.4 Clip-Level Gating via Synapse Weight Modulation

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

### 13.5 Crossfade Behavior

1. **Scene at 0:** Verse weight = 1000 (fires), Chorus weight = 0 (skipped).
2. **Scene at 500 (mid-crossfade):** Both weights > 0. Both fire. Verse at 50% velocity, chorus at 50%.
3. **Scene at 1000:** Verse weight = 0 (skipped), Chorus weight = 1000 (fires).
4. **Verse's active voices** ring out via DSP-layer ADSR release tails (polyphonic persistence, §15).

Smoothing factor on `Scene` controls crossfade speed.

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

## 15. DSP/Kernel Boundary

### 15.1 Polyphonic Persistence

When a synaptic weight drops to 0:

1. **Sequencer** stops scheduling new `noteOn` events for that path.
2. **Already-active voices** hit their `DURATION` → sequencer fires `noteOff`.
3. **DSP layer** transitions voice to `RELEASE` → `EnvelopeModule` autonomously renders release tail.
4. **`is_near_silent()`** detects silence → voice transitions to `IDLE` → reclaimed.

No SAB coordination needed. No `VOICE_ID` or `ENVELOPE_ID` in the node struct.

### 15.2 Voice Independence

The kernel never receives a voice index. Communication is one-way:

```
Kernel: "play pitch 60, velocity 0.8"  →  DSP (routed via synapse target)
DSP:    (internally) find_idle_voice() → allocate → render → release → reclaim
```

Changing a synth from 8-voice polyphonic to monophonic with glide requires zero changes to the SAB, sequencer, or modulation system. Only the DSP layer's `max_voices` and `steal_policy` change.

---

## 16. Sequencer

> **Extraction mandate:** Sequencing logic currently resides in `packages/web/src/runtime/processor.ts`. This RFC mandates its extraction into `packages/kernel` (Rust). After extraction, `processor.ts` retains only I/O glue — zero musical logic.

### 16.1 Kernel-Side Interface

```rust
pub trait EventSink {
    fn note_on(&mut self, target_id: u32, pitch: u32, velocity: i32,
               gate_offset: i32, expression_id: u32);
    fn note_off(&mut self, target_id: u32, pitch: u32, expression_id: u32);
    fn control_change(&mut self, target_id: u32, controller: u32, value: i32);
}

pub trait Sequencer {
    /// Advance by one audio block.
    /// 1. Evaluates all active parameters (batch).
    /// 2. Traverses node chain for [start_tick, end_tick).
    /// 3. Evaluates CONTEXT modulators inline (hash + LUT).
    /// 4. Checks gate modulators — skips gated nodes.
    /// 5. Emits BOUNDARY signals to SIGNAL_RING.
    /// 6. Routes note/CC events to the EventSink.
    fn advance(&mut self, start_tick: u32, end_tick: u32,
               frame_count: u32, samples_per_tick_q16: u32);
}
```

### 16.2 Web-Side Thin Shell (After Extraction)

```typescript
// packages/web/src/runtime/processor.ts — thin I/O shell
class SymphonyScriptProcessor extends AudioWorkletProcessor {
  private sequencer: ISequencer;
  private engine: Engine;       // implements IEventSink

  process(inputs, outputs): boolean {
    this.linker.poll();
    const startTick = this.linker.getPlayheadTick();
    const ticksInBlock = frameCount / samplesPerTick;

    this.sequencer.advance(startTick, startTick + ticksInBlock,
                           frameCount, samplesPerTick);

    const rendered = this.engine.render();
    this.copyToOutput(rendered, outputs[0]);
    this.linker.setPlayheadTick(startTick + ticksInBlock);
    return true;
  }
}
```

**After extraction:** processor.ts has ZERO musical logic. It is only I/O glue. All sequencing, parameter evaluation, gate checking, boundary emission, and synapse resolution live in the kernel.

### 16.3 Portability

The `EventSink` and `Sequencer` traits are platform-agnostic. Porting to native audio backends requires only rewriting the thin I/O shell.

---

## 17. Command Protocol

### 17.1 Opcodes

```rust
pub const CMD_CREATE_MOD: u32 = 7;  // Create and link a modulator
pub const CMD_DELETE_MOD: u32 = 8;  // Unlink and free a modulator
```

### 17.2 CREATE_MOD

Payload: `[CMD_CREATE_MOD, NodePtr, ModulatorPtr, 0]`

1. Bridge pre-writes all config fields to `MODULATION_TABLE[ModulatorPtr]` via `Atomics.store`
2. Bridge enqueues command via Ring Buffer
3. Worker links modulator into node's `MOD_LIST_HEAD` chain:
   ```rust
   new_mod.set_next_mod_ptr(node.mod_list_head());
   node.set_mod_list_head(modulator_ptr);
   ```

### 17.3 DELETE_MOD

Payload: `[CMD_DELETE_MOD, NodePtr, ModulatorPtr, 0]`

Worker traverses `MOD_LIST_HEAD` chain, unlinks modulator, returns slot to free list.

### 17.4 Direct Updates (No Command Needed)

| Operation | Method |
|:---|:---|
| `setParam(id, value)` | `Atomics.store` to `RAW_VALUE` |
| Update `AMOUNT_VALUE` | `Atomics.store` to mod field |
| Update `PACKED_CFG_A/B` | `Atomics.store` to mod field |

SPSC-safe: Bridge is sole writer, audio engine is sole reader. Each field is a single `i32` (atomically aligned).

---

## 18. Composition API

### 18.1 Parameter IDs

User-defined per composition via `as const` objects:

```typescript
const PARAM = {
  Intensity: 0,
  CrowdEnergy: 1,
  Scene: 2,
  Vibrato: 3,
} as const;
```

1024 slots. User assigns meaning. Compiles to plain numbers.

### 18.2 Parameter Interface

```typescript
interface IParam {
  readonly paramId: number;
  smooth(factor: number, type?: 'exponential' | 'linear'): this;
  curve(type: string | [number, number, number, number]): this;
  bipolar(enabled: boolean): this;
  lfo(waveform: 'sine' | 'triangle' | 'square' | 'saw', frequencyHz: number): this;
  register(bridge: SiliconBridge): void;
}
```

```typescript
const Intensity = Param.create(PARAM.Intensity)
  .smooth(0.95).curve('easeIn').bipolar(false);

const Vibrato = Param.create(PARAM.Vibrato)
  .lfo('sine', 4.0).bipolar(true);
```

### 18.3 Modulator Interface

```typescript
interface IModulatorBase<T extends IModulatorBase<T>> {
  base(value: number): T;
  amount(value: number): T;
  smooth(factor: number, type?: 'exponential' | 'linear'): T;
  curve(type: string | [number, number, number, number]): T;

  // Polarity
  unipolar(): T;
  bipolar(): T;

  // Built-in curve shapes (map to pre-baked LUT slots 0-5)
  linear(): T;
  easeIn(): T;
  easeOut(): T;
  centered(): T;    // -1 → 0 → +1
  diverge(): T;     // 1 → 0 → 1 (V-shape)
  converge(): T;    // -1 → 1 → -1 (inv-V)
  symmetric(): T;   // sine wobble
  ducker(): T;      // 0 → -1

  // Tap source
  tapSmoothed(): T; // default — fully smoothed
  tapCurved(): T;   // skip smoothing
  tapRaw(): T;      // bypass all
  direct(): T;      // alias for tapRaw()
}
```

### 18.4 Typed Factory Methods

```typescript
class Modulator {
  static velocity(param: IParam): IVelocityModulator;
  // targetProperty=0x00, clamp=true, polarity=unipolar

  static pitch(param: IParam): IPitchModulator;
  // targetProperty=0x01, clamp=false, polarity=bipolar

  static duration(param: IParam): IDurationModulator;
  // targetProperty=0x02

  static tempo(param: IParam): ITempoModulator;
  // targetProperty=0x03, clamp=true (floor 20 BPM), polarity=bipolar

  static filter(param: IParam): IFilterModulator;
  // targetProperty=0x04, clamp=false, polarity=unipolar

  static volume(param: IParam): IVolumeModulator;
  // targetProperty=0x05, clamp=true, polarity=unipolar

  static pan(param: IParam): IPanModulator;
  // targetProperty=0x06, clamp=true, polarity=bipolar

  static synapseWeight(param: IParam): ISynapseWeightModulator;
  // targetProperty=0x07, clamp=true, polarity=unipolar
  // Evaluated at synapse resolution, not voice render
}
```

#### 18.4.1 Property-Specific Interfaces

```typescript
interface IVelocityModulator extends IModulatorBase<IVelocityModulator> {
  // Default polarity: UNIPOLAR (only adds velocity)
  // Default clamping: CLAMP_0_1 = true
}

interface IPitchModulator extends IModulatorBase<IPitchModulator> {
  /** Convenience: set amount in octaves (amount × 12). */
  octaves(n: number): this;
  // Default polarity: BIPOLAR
  // Default clamping: false (unbounded)
}

interface IDurationModulator extends IModulatorBase<IDurationModulator> {
  // Default polarity: BIPOLAR
  // Default clamping: false
}

interface ITempoModulator extends IModulatorBase<ITempoModulator> {
  // Default polarity: BIPOLAR (speed up / slow down)
  // Default clamping: floor clamp at 20 BPM
}

interface IFilterModulator extends IModulatorBase<IFilterModulator> {
  // Default polarity: UNIPOLAR
  // Default clamping: false (unbounded Hz)
}

interface IVolumeModulator extends IModulatorBase<IVolumeModulator> {
  // Default polarity: UNIPOLAR
  // Default clamping: CLAMP_0_1 = true
}

interface IPanModulator extends IModulatorBase<IPanModulator> {
  // Default polarity: BIPOLAR (left/right)
  // Default clamping: clamped to [-65536, 65536]
}

interface ISynapseWeightModulator extends IModulatorBase<ISynapseWeightModulator> {
  // Default polarity: UNIPOLAR
  // Default clamping: CLAMP_0_1 = true (0-1000)
  // Evaluated at synapse resolution, not voice render
}
```

### 18.5 Inline Cursors

```typescript
interface IModulatableCursor<TCursor, TClip> {
  mod(param: IParam): IModulatorCursorBinding<TCursor, TClip>;
}

interface IModulatorCursorBinding<TCursor, TClip>
  extends IModulatorBase<IModulatorCursorBinding<TCursor, TClip>> {
  mod(param: IParam): IModulatorCursorBinding<TCursor, TClip>;
  // Escape methods back to clip:
  note(pitch: string | number, duration?: number): TClip;
  rest(duration?: number): TClip;
}
```

```typescript
Clip.melody()
  .note('C4')
  .velocity(700)
    .mod(Intensity).amount(300).easeIn()
    .mod(CrowdEnergy).amount(100).linear()
  .note('E4')       // escape back to clip
```

Both paths (reusable modulator + inline cursor) produce identical `MODULATION_TABLE` entries.

**Reusable modulator attachment workflow:**

```typescript
// 1. Create reusable modulator (no SAB write yet — just config object)
const intensityVel = Modulator.velocity(Intensity).base(700).amount(300).easeIn();

// 2. Attach to a note property (triggers SAB allocation)
note('C4').velocity(700, intensityVel);         // explicit base + mod
note('E4').velocity(intensityVel);              // mod's internal base
note('G4').velocity(900, intensityVel, energyVel); // two mods (additive)

// Under the hood (per modulator attachment):
// a) Bridge claims free slot from MOD_ALLOC free-list
// b) Bridge writes all 8 config fields via Atomics.store
// c) Bridge enqueues CMD_CREATE_MOD(nodePtr, modSlotPtr)
// d) Audio thread links modulator into node's MOD_LIST_HEAD chain
```

### 18.6 Gating DSL

```typescript
note('G4')
  .threshold(700, Density)    // GATE: SOURCE=PARAM, BASE=700
  .probability(40)            // GATE: SOURCE=CONTEXT, contextId=HASH_NOISE, BASE=400
  .humanize(30)               // CONTEXT: contextId=HASH_NOISE, target=VELOCITY, Amount=30
  .jitter(10, 'frozen')       // CONTEXT: target=TICK_OFFSET, USE_BASE_TICK
```

### 18.7 Runtime Updates

```typescript
bridge.setParam(PARAM.Intensity, 750);   // 75%
bridge.setParam(PARAM.Swing, -300);      // 30% behind beat

// Inside SiliconBridge:
setParam(paramId: number, value: number): void {
  const offset = this.paramTableOffsetI32 + paramId * PARAM_STRIDE_I32;
  const fixed = (value * 65536 / 1000) | 0;
  Atomics.store(this.sab, offset + PARAM_RAW_VALUE, fixed);
}
```

---

## 19. LFO as Internal Parameter Source

When `FLAGS.INTERNAL_SOURCE` is set, the audio engine generates `RAW_VALUE` each block:

```rust
pub fn generate_waveform(phase: u32, waveform: u8) -> i32 {
    let norm = (phase >> 16) & 0xFFFF; // 0-65535
    match waveform {
        SINE => {
            // 4th-order Taylor: sin(x) ≈ x - x³/6 + x⁵/120
            let x = norm as i32 - 32768;
            let x = (x * 201) >> 6;          // scale to ±π in Q16.16
            let x2 = (x * x) >> 16;
            let x3 = (x2 * x) >> 16;
            let x5 = (x3 * x2) >> 16;
            x - ((x3 * 10923) >> 16) + ((x5 * 546) >> 16)
            // 10923 ≈ 65536/6, 546 ≈ 65536/120
        }
        TRIANGLE => {
            if norm < 16384 { (norm as i32) * 4 }
            else if norm < 49152 { 131072 - (norm as i32) * 4 }
            else { (norm as i32) * 4 - 262144 }
        }
        SQUARE => if norm < 32768 { 65536 } else { -65536 },
        SAW    => (norm as i32 * 2) - 65536,
        _ => 0,
    }
}

/// Phase increment per audio block.
/// Called on bridge/main thread at init or when frequency changes — NOT in the kernel.
/// Result stored in ParamView and used as pure integer addition in the audio loop.
pub fn compute_phase_increment(freq_q8_24: u32, block_size: u32, sample_rate: u32) -> u32 {
    let freq_hz = freq_q8_24 as f64 / (1u64 << 24) as f64;
    ((4294967296.0 * freq_hz / sample_rate as f64) * block_size as f64) as u32
}
```

Same signal chain: `generate RAW_VALUE → curve → smooth → modulators read SMOOTHED_VALUE`.

**Note:** `compute_phase_increment` uses f64 but runs on the bridge/main thread only. The kernel's audio loop uses only the pre-computed integer result: `phase = phase.wrapping_add(phase_increment)`.

LFO `PACKED_CFG_B` when `INTERNAL_SOURCE = 1`:

```
Bits 31-24: Waveform (0x00=SINE, 0x01=TRIANGLE, 0x02=SQUARE, 0x03=SAW, 0x04=LUT)
Bits 23-0:  Frequency (Q8.24 fixed-point Hz). Example: 4.0 Hz = 4 << 24 = 67108864
```

---

## 20. Expression DSL (`Expr`)

Unified expression system for derived parameter values and conditional routing. Data structures, not closures — serializable and kernel-compilable.

### 20.0 IExpr Interface

```typescript
interface IExpr {
  readonly type: ExprType;
  /** Compile to kernel-side packed representation. */
  compile(): { cfgB: number; auxFields?: number[] };
  /** Serialize to JSON (for save/export). */
  toJSON(): object;
}
```

All `Expr` factory methods return `IExpr`. Both `IParam` and `IExpr` are accepted as sources.

### 20.1 Arithmetic Operators

```typescript
Expr.add(a, b)       // A + B
Expr.sub(a, b)       // A - B
Expr.mul(a, b)       // (A × B) >> 16 (Q16.16 multiply)
Expr.div(a, b)       // (A << 16) / B
Expr.min(a, b)       // min(A, B)
Expr.max(a, b)       // max(A, B)
Expr.abs(a)          // |A|
Expr.neg(a)          // -A
Expr.lerp(a, b, t)   // A + (B - A) × T >> 16
Expr.scale(a, factor) // (A × factor) >> 16
Expr.value(n)        // Q16.16 constant
Expr.clamp(a, lo, hi) // clamp(A, lo, hi)
Expr.mod(a, b)       // A mod B
```

### 20.2 Comparison Operators (produce boolean conditions)

```typescript
Expr.gt(a, threshold)        // A > threshold
Expr.lt(a, threshold)        // A < threshold
Expr.gte(a, threshold)       // A >= threshold
Expr.lte(a, threshold)       // A <= threshold
Expr.eq(a, threshold, eps?)  // |A - threshold| < epsilon
Expr.between(a, lo, hi)      // lo < A < hi
Expr.outside(a, lo, hi)      // A < lo || A > hi
```

### 20.3 Logical Operators

```typescript
Expr.and(a, b)    // A && B
Expr.or(a, b)     // A || B
Expr.not(a)       // !A
```

### 20.4 Kernel Compilation

Simple expressions (single operator, two sources) encode in `PACKED_CFG_B`:

```
Bits 31-28: Operator (4 bits)
  0x0=ADD  0x4=MIN  0x8=ABS  0xC=MOD
  0x1=SUB  0x5=MAX  0x9=NEG
  0x2=MUL  0x6=LERP 0xA=SCALE
  0x3=DIV  0x7=CLAMP 0xB=CONST

Bits 27-16: Source Param A (12 bits = 4096 param IDs)
Bits 15-4:  Source Param B (12 bits)
Bits 3-0:   Source C / flags (for LERP, CLAMP)
```

Complex (nested) expressions: bit 0 of flags = `COMPLEX`, remaining bits encode a `LUT_POOL` slot index where the flattened instruction sequence resides.

### 20.5 Derived Parameters

```typescript
const FinalPitch = Param.derive(Expr.add(BasePitch, Expr.mul(Scene, Expr.value(12))));
const BlendedVel = Param.derive(Expr.lerp(VelocityA, VelocityB, MixParam));
```

- `FLAGS.DERIVED` bit (bit 3) set on the parameter
- `RAW_VALUE` computed from source params' `SMOOTHED_VALUE` each block
- Two-pass evaluation: non-derived first, derived second
- Circular dependencies rejected at `Param.derive()` time

### 20.6 Conditional Routing

```typescript
parent.linkTo(verseClip)
  .mod(Scene).base(1000).amount(-1000)
  .when(Expr.gt(Scene, 500));   // Only active when Scene > 500
```

`.when()` gates the modulator's delta to 0 when the condition is false. Condition stored in modulator auxiliary field. Evaluated during modulator chain traversal.

#### 20.6.1 Dual-Mode `.when()`

Both serializable expressions and arrow functions are accepted:

```typescript
// Serializable — kernel-compiled, preserves phantom type
.when(Expr.gt(Scene, 500))

// Arrow — taints clip as Unserializable (RFC-058 phantom type)
.when(v => v > 500)
```

The `Expr` form compiles to kernel-side evaluation (condition encoded in modulator auxiliary field). The arrow form is evaluated by the engine layer at block rate — the same code module is loaded in the AudioWorklet via `addModule()`, giving the audio thread access to the callback. Arrow-based `.when()` taints the clip as `Unserializable` per RFC-058 phantom type system.

---

## 21. Fire Trace (Observability)

### 21.1 Snapshot Model

Fire trace is SAB **state**, not a stream. Audio thread overwrites per-synapse fields during resolution. Consumer pulls snapshots on demand.

```rust
/// Zero-cost view over synapse fire trace slots in the SAB.
pub struct SynapseFireView {
    sab: SAB,
    start_index: usize,
}

impl SynapseFireView {
    pub fn last_fire_tick(&self) -> u32 { self.read(0) as u32 }
    pub fn set_last_fire_tick(&self, v: u32) { self.write(0, v as i32) }
    pub fn last_effective_weight(&self) -> i32 { self.read(1) }
    pub fn set_last_effective_weight(&self, v: i32) { self.write(1, v) }
    pub fn last_effective_pitch(&self) -> i32 { self.read(2) }
    pub fn set_last_effective_pitch(&self, v: i32) { self.write(2, v) }
    pub fn last_effective_velocity(&self) -> i32 { self.read(3) }
    pub fn set_last_effective_velocity(&self, v: i32) { self.write(3, v) }
    pub fn fire_count(&self) -> u32 { self.read(4) as u32 }
    pub fn increment_fire_count(&self) {
        self.write(4, self.read(4) + 1)
    }
    pub fn reset_fire_count(&self) { self.write(4, 0) }

    fn read(&self, offset: usize) -> i32 {
        self.sab[self.start_index + offset].load(Ordering::Relaxed)
    }
    fn write(&self, offset: usize, v: i32) {
        self.sab[self.start_index + offset].store(v, Ordering::Relaxed)
    }
}
```

| Field | Writer | Reader |
|:---|:---|:---|
| `last_fire_tick` | Audio engine | Main thread (consumer) |
| `last_effective_weight/pitch/velocity` | Audio engine | Main thread (consumer) |
| `fire_count` | Audio engine (increment) | Main thread (read + reset) |

Consumer API: `getFireTraceSnapshot(buffer)`, `resetFireCounters()`. Zero allocation. Consumer controls poll frequency (1-60 Hz).

### 21.2 Ring Buffer Stream (Future Extension)

Additive — a dedicated SPSC ring buffer alongside snapshots for event history, analytics, or replay.

#### 21.2.1 Stream Entry Format

```rust
pub const TRACE_TICK: usize = 0;               // Tick when event fired
pub const TRACE_NODE_PTR: usize = 1;            // Byte offset of target node
pub const TRACE_SYNAPSE_PTR: usize = 2;         // Byte offset of synapse that fired
pub const TRACE_EFFECTIVE_WEIGHT: usize = 3;    // Effective weight after modulation (0-1000)
pub const TRACE_EFFECTIVE_PITCH: usize = 4;     // Effective pitch after deltas (Q16.16)
pub const TRACE_EFFECTIVE_VELOCITY: usize = 5;  // Effective velocity after deltas (Q16.16)
pub const TRACE_EFFECTIVE_DURATION: usize = 6;  // Effective duration after deltas
pub const TRACE_RESERVED: usize = 7;            // Reserved
pub const TRACE_STRIDE_I32: usize = 8;          // 32 bytes per entry
```

Power-of-2 slot count (e.g., 256 entries). Overflow drops entries, never blocks audio. SPSC: audio thread writes, main thread reads.

## 22. Mechanical Specifications

### 22.1 Modulator Allocator

Free-list mirroring node allocation. `HDR_MOD_ALLOC_HEAD` → linked chain of free slots. Each free slot uses `next_mod_ptr` to chain to the next. Pop on `CMD_CREATE_MOD`, push on `CMD_DELETE_MOD`. Initialized during `init_sab()` as a linked chain of all slots.

### 22.2 Error Handling

```rust
pub const BRIDGE_ERR_MOD_TABLE_FULL: i32 = -5;
pub const BRIDGE_ERR_LUT_POOL_FULL: i32 = -6;
```

Bridge-side only — audio thread never allocates.

### 22.3 Parameter Deregistration

`FLAGS.ACTIVE = 0`. Modulators read frozen `SMOOTHED_VALUE`. No auto-cleanup. If slot reused via `Param.create()` with the same ID, existing modulators seamlessly read the new parameter.

### 22.4 PARAM_NONE Sentinel

When a CONTEXT modulator has no controlling param (e.g., simple `.humanize(30)`), `param_id = 0xFFFF` (PARAM_NONE). Depth is treated as fixed (full depth = 1000).

### 22.5 Tempo Modulation

Sequencer reads `PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE` at block start, derives `samples_per_tick`. Constant within block. Max timing error: ~0.1 ticks at 2.7ms blocks. Below human perception.

### 22.6 LUT Deduplication

Bridge-side: pre-allocated flat arrays (no Map, no objects):

```rust
lut_hashes: [i32; 128],      // curve hash per slot
lut_ref_counts: [i32; 128],  // reference count per slot
lut_free_head: usize,        // free-list head
```

Workflow: hash control points → linear probe for match → reuse or claim free slot → compute 256 entries → write to SAB. LUT data written before `CMD_CREATE_MOD` is enqueued (FIFO ordering guarantees audio thread never reads uninitialized LUT).

### 22.7 Debug Inspection

Caller provides pre-allocated buffer. Zero allocation.

```rust
/// Read all 8 fields of a parameter slot.
pub fn inspect_param(sab: &[i32], param_id: usize, out: &mut [i32; 8]) {
    let offset = param_table_offset + param_id * PARAM_STRIDE_I32;
    for i in 0..8 {
        out[i] = atomic_load(&sab[offset + i]);
    }
}

/// Read all 8 fields of a modulator slot.
pub fn inspect_mod(sab: &[i32], mod_offset: usize, out: &mut [i32; 8]) {
    let offset_i32 = mod_offset / 4;
    for i in 0..8 {
        out[i] = atomic_load(&sab[offset_i32 + i]);
    }
}
```

Consistent with `read_node_raw()` pattern — caller-owned buffers, zero heap allocation.

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
| 24 | Score vs Performer boundary | One-way kernel→DSP, voice lifetime in DSP only |
| 25 | Sequencer in kernel | Platform-agnostic, Rust-portable via `EventSink` trait |
| 26 | registerParamResolver vs registerContextResolver | Separate APIs for separate storage targets. Name IS the type |

---

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
| SynapticCursor class | Deleted entirely. Surviving logic (hash lookup, chain traversal) folds into kernel sequencer |

---

## Appendix C: Newton-Raphson Bézier Solver

Reference implementation for computing LUT entries from cubic bézier curves:

```rust
/// Compute a 256-entry LUT for a cubic bézier curve.
/// Called on bridge/main thread when a new bezier curve is registered.
pub fn compute_bezier_lut(
    x1: f64, y1: f64, x2: f64, y2: f64,
    sab: &mut [i32],
    slot_offset: usize,
) {
    for i in 0..256 {
        let target_x = i as f64 / 255.0;
        let t = solve_cubic_bezier_t(target_x, x1, x2);
        let y = cubic_bezier_y(t, y1, y2);
        let fixed = (y * 65536.0) as i32;
        sab[slot_offset + i] = fixed; // Atomics.store equivalent
    }
}

/// Solve x(t) = target_x for t using Newton-Raphson (8 iterations).
fn solve_cubic_bezier_t(target_x: f64, x1: f64, x2: f64) -> f64 {
    let mut t = target_x; // initial guess
    for _ in 0..8 {
        let t2 = t * t;
        let t3 = t2 * t;
        let mt = 1.0 - t;
        let mt2 = mt * mt;

        let x = 3.0 * mt2 * t * x1 + 3.0 * mt * t2 * x2 + t3;
        let err = x - target_x;
        if err.abs() < 1e-7 { break; }

        let dx = 3.0 * mt2 * x1 + 6.0 * mt * t * (x2 - x1) + 3.0 * t2 * (1.0 - x2);
        if dx.abs() < 1e-10 { break; }

        t = (t - err / dx).clamp(0.0, 1.0);
    }
    t
}

/// Evaluate y(t) for cubic bézier: y(t) = 3(1-t)²t·y1 + 3(1-t)t²·y2 + t³
fn cubic_bezier_y(t: f64, y1: f64, y2: f64) -> f64 {
    let mt = 1.0 - t;
    3.0 * mt * mt * t * y1 + 3.0 * mt * t * t * y2 + t * t * t
}
```

---

## Appendix D: Reference Modulator Factory Implementation

```typescript
/**
 * Reference implementation of Modulator.velocity().
 * All other factories (pitch, volume, pan, tempo, filter, synapseWeight)
 * follow the same pattern — they differ only in:
 *   1. targetProperty (PACKED_CFG_A bits 31-24)
 *   2. defaultClamp (PACKED_CFG_A bit 15)
 *   3. defaultPolarity (PACKED_CFG_A bit 14)
 *   4. Domain-specific convenience methods
 */
class VelocityModulatorConfig implements IVelocityModulator {
  private _paramId: number;
  private _base: number = 0;                  // Q16.16
  private _amount: number = 0;                // Q16.16
  private _smoothFactor: number = 0;          // 12-bit
  private _clamp: boolean = true;             // Velocity default: clamped
  private _polarity: boolean = false;         // Velocity default: unipolar
  private _tapSource: number = 0x00;          // SMOOTHED (default)
  private _curveType: number = 0x00;          // LINEAR (default)
  private _curveParam: number = 0;
  private _sourceMode: number = 0;            // PARAM (default)
  private _frozenTick: boolean = false;

  constructor(param: IParam) {
    this._paramId = param.paramId;
  }

  base(value: number): this {
    this._base = (value * 65536 / 1000) | 0;
    return this;
  }

  amount(value: number): this {
    this._amount = (value * 65536 / 1000) | 0;
    return this;
  }

  smooth(factor: number): this {
    this._smoothFactor = (factor * 4096) | 0; // 12-bit
    return this;
  }

  curve(type: string | [number, number, number, number]): this {
    if (Array.isArray(type)) {
      this._curveType = 0x04;   // LUT
      // LUT index assigned during register() — bridge.allocLut(type)
    } else {
      switch (type) {
        case 'centered': this._curveType = 0x04; this._curveParam = 1; break;
        case 'diverge':  this._curveType = 0x04; this._curveParam = 2; break;
        case 'converge': this._curveType = 0x04; this._curveParam = 3; break;
        case 'symmetric':this._curveType = 0x04; this._curveParam = 4; break;
        case 'ducker':   this._curveType = 0x04; this._curveParam = 5; break;
      }
    }
    return this;
  }

  unipolar(): this { this._polarity = false; return this; }
  bipolar(): this  { this._polarity = true; return this; }
  linear(): this   { this._curveType = 0x00; return this; }
  easeIn(): this   { this._curveType = 0x01; return this; }
  easeOut(): this  { this._curveType = 0x01; this._curveParam = 256; return this; }
  centered(): this { return this.curve('centered'); }
  diverge(): this  { return this.curve('diverge'); }
  converge(): this { return this.curve('converge'); }
  symmetric(): this { return this.curve('symmetric'); }
  ducker(): this   { return this.curve('ducker'); }
  tapSmoothed(): this { this._tapSource = 0x00; return this; }
  tapCurved(): this   { this._tapSource = 0x01; return this; }
  tapRaw(): this      { this._tapSource = 0x02; return this; }
  direct(): this      { return this.tapRaw(); }

  /** Pack config into MODULATION_TABLE PACKED_CFG_A. */
  packConfigA(): number {
    const targetProperty = 0x00; // VELOCITY
    return (targetProperty << 24)
         | (this._tapSource << 16)
         | (this._clamp ? (1 << 15) : 0)
         | (this._polarity ? (1 << 14) : 0)
         | (this._sourceMode << 13)
         | (this._frozenTick ? (1 << 12) : 0)
         | (this._smoothFactor & 0xFFF);
  }

  packConfigB(): number {
    return (this._curveType << 24) | (this._curveParam & 0x00FFFFFF);
  }

  getParamId(): number { return this._paramId; }
  getBase(): number { return this._base; }
  getAmount(): number { return this._amount; }
}

// Factory:
class Modulator {
  static velocity(param: IParam): IVelocityModulator {
    return new VelocityModulatorConfig(param);
  }
  // Other factories differ only in:
  // pitch():  targetProperty=0x01, clamp=false, polarity=true(bipolar)
  // volume(): targetProperty=0x05, clamp=true,  polarity=false(unipolar)
  // pan():    targetProperty=0x06, clamp=true,  polarity=true(bipolar)
  // tempo():  targetProperty=0x03, clamp=true,  polarity=true(bipolar)
  // filter(): targetProperty=0x04, clamp=false, polarity=false(unipolar)
  // synapseWeight(): targetProperty=0x07, clamp=true, polarity=false(unipolar)
}
```

---

## Appendix E: Sequencer Extraction Map

Line-by-line mapping from `packages/web/src/runtime/processor.ts` to the kernel-side `Sequencer`.

### E.1 Source → Destination

| Source (processor.ts) | Destination | Notes |
|:---|:---|:---|
| Tempo calculation: `samplesPerTick = ...` | `Sequencer::compute_tempo()` | Reads from `PARAMETER_TABLE[TEMPO].SMOOTHED_VALUE` |
| Node traversal: `while (ptr !== NULL_PTR)` | `Sequencer::advance()` | Main loop. Add synapse resolution at chain end |
| `routeNodeEvents()` | `Sequencer::route_node()` | Add `MOD_LIST_HEAD != NULL_PTR` check for lazy eval |
| `normalizeMidi()` | `Sequencer::normalize_midi()` | Copy unchanged |
| `tickToGateOffset()` | `Sequencer::tick_to_gate_offset()` | Copy unchanged |
| **New:** Parameter batch | `Sequencer::evaluate_params()` | §8.1 pseudocode. Runs before traversal |
| **New:** Synapse resolution | `Sequencer::resolve_synapses()` | All-fire model (§13.1) |

### E.2 What Stays in processor.ts

```typescript
// packages/web/src/runtime/processor.ts — post-extraction (thin shell)
class SymphonyScriptProcessor extends AudioWorkletProcessor {
  private sequencer!: Sequencer;
  private engine!: Engine;  // implements EventSink

  public process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output) return true;
    this.clearOutput(output);
    if (!this.isInitialized || !this.isPlaying) return true;

    this.linker.poll();
    const startTick = this.linker.getPlayheadTick();
    const frameCount = output[0]?.length ?? 0;

    this.sequencer.advance(startTick, startTick + ticksInBlock,
                           frameCount, samplesPerTickQ16);

    const rendered = this.engine.render();
    this.copyRenderedBuffer(rendered, output);
    this.linker.setPlayheadTick(endTick);
    return true;
  }
  // clearOutput(), copyRenderedBuffer(), handleMessage() stay — web-specific I/O
}
```

---

## 23. Migration Plan

### 23.1 Phased Implementation Order

1. **Phase 1 — Constants + Node expansion.** Update `constants.ts`: `NODE_SIZE_I32 = 16`, add `MOD_LIST_HEAD`, new `HDR` fields. All dependent code auto-adjusts via `NODE_SIZE_I32` / `NODE_SIZE_BYTES`. Update `Int32Array(8)` allocations.

2. **Phase 2 — Stochastic removal.** Delete `SynapticCursor.ts`. Remove `jitter` from all APIs. Remove `SYN_PACK.JITTER_*` constants. Implement deterministic all-fire resolution.

3. **Phase 3 — New SAB tables.** Add `PARAMETER_TABLE`, `MODULATION_TABLE`, `LUT_POOL` constants, offset functions, `calculateSABSize()` updates. Initialization in `init.ts`.

4. **Phase 4 — Command protocol.** Add `CMD_CREATE_MOD` / `CMD_DELETE_MOD` handlers to `processCommands()`.

5. **Phase 5 — Bridge integration.** Add `setParam()`, modulator allocation, LUT deduplication to `SiliconBridge`.

6. **Phase 6 — Sequencer extraction.** Move `routeNodeEvents` logic to kernel-side `Sequencer`. Add parameter batch evaluation, synapse resolution (all-fire).

7. **Phase 7 — Composition API.** Implement `Param`, `Modulator` factories, inline cursors, `linkTo()` modulation.

### 23.2 Files Affected (Phase 1 — Node Expansion)

| File | Change |
|:---|:---|
| `constants.ts` | `NODE_SIZE_I32 = 16`, `MOD_LIST_HEAD`, new HDR fields, offset functions, `calculateSABSize()` |
| `silicon-synapse.ts` | `nodeOffset()`, `writeNodeData()`, `readNodeRaw()`, buffer sizing |
| `silicon-bridge.ts` | `nodeBuf = new Int32Array(16)`, `writeNodeData` calls |
| `local-allocator.ts` | Extend zeroing to 16 fields |
| `processor.ts` | `nodeBuf = new Int32Array(16)` |
| Test files (7) | `Int32Array(8)` → `Int32Array(16)`, offset calculations |

### 23.3 Files Affected (Phase 2 — Stochastic Removal)

| File | Change |
|:---|:---|
| `SynapticCursor.ts` | **Deleted** |
| `SynapticNode.ts` | Remove `jitter` param from `linkTo()` / `connect()` |
| `silicon-bridge.ts` | Remove `jitter` from `connect()`, `connectAsync()`, snapshots |
| `synapse-allocator.ts` | Remove `jitter` from `connect()`, update `WEIGHT_DATA` packing |
| `constants.ts` | Remove `SYN_PACK.JITTER_MASK/SHIFT` |
| `types.ts` | Remove `jitter` from `SynapseResolutionCallback`, `SynapseSnapshot` |

---

## Appendix F: Test Plan

### F.1 Phase 1 — Node Expansion

| Test | Assertion |
|:---|:---|
| `NODE_SIZE_I32 === 16` | Constant check |
| `NODE_SIZE_BYTES === 64` | Constant check |
| Allocate node, verify 16 slots writable | Write/read all slots 0-15 |
| `MOD_LIST_HEAD` default = `NULL_PTR` | Verify slot 8 = 0 after allocation |
| Existing tests pass unchanged | Full suite regression |

### F.2 Phase 2 — Stochastic Removal

| Test | Assertion |
|:---|:---|
| `SynapticCursor.ts` does not exist | File system check |
| `SYN_PACK.JITTER_*` do not exist | Grep verify |
| Multiple synapses from same source all fire | Create 3 synapses with weights 800, 500, 300. All 3 targets receive noteOn |
| Weight 0 does NOT fire | Create synapse with weight 0. No noteOn |
| Weight scales velocity | Weight 500 → velocity = original × 0.5 |

### F.3 Phase 3 — New SAB Tables

| Test | Assertion |
|:---|:---|
| Offset functions return correct values | `getParamTableOffset()`, `getModTableOffset()`, `getLutPoolOffset()` |
| `calculateSABSize()` includes new regions | Size ≥ previous + 32KB + 128KB + 128KB |
| Parameter slot write/read via `Atomics` | Write `RAW_VALUE`, read back |
| Modulator slot write/read | Write all 8 fields, read back |
| LUT slot write 256 entries | Write LUT, read entries 0 and 255 |

### F.4 Phase 4 — Command Protocol

| Test | Assertion |
|:---|:---|
| `CMD_CREATE_MOD` links modulator to node | `MOD_LIST_HEAD` points to mod |
| Multiple mods form linked list | Create 3 mods on same node. Traverse chain, verify all 3 |
| `CMD_DELETE_MOD` unlinks modulator | Chain skips deleted mod |
| Delete returns slot to free list | Slot reusable via next CREATE_MOD |

### F.5 Phase 5 — Bridge Integration

| Test | Assertion |
|:---|:---|
| `setParam(id, 750)` writes correct Q16.16 | `Atomics.load` returns `(750 * 65536 / 1000) \| 0 = 49152` |
| `createModulator()` when full returns error | `BRIDGE_ERR_MOD_TABLE_FULL` |
| LUT dedup: same curve reuses slot | Alloc [0.42,0,0.58,1] twice → same lutIndex, refCount=2 |
| `inspectParam()` reads all 8 fields | Write known values, inspect, verify |

### F.6 Phase 6 — Sequencer Extraction

| Test | Assertion |
|:---|:---|
| `advance()` fires noteOn for nodes in range | Same behavior as processor.ts |
| Parameter batch evaluation runs before traversal | Set RAW_VALUE, verify SMOOTHED_VALUE updated after advance() |
| LFO generates changing RAW_VALUE | Create sine 4Hz param. Two advance() calls → different RAW_VALUE |
| Synapse resolution: all weight > 0 fire | End-of-clip triggers noteOn on all connected targets |
| processor.ts has zero musical logic | Grep for `routeNodeEvents` → not found |

### F.7 Phase 7 — Composition API

| Test | Assertion |
|:---|:---|
| `Param.create().smooth(0.95)` stores config | PACKED_CFG_A contains smooth factor |
| `Param.create().lfo('sine', 4.0)` sets INTERNAL_SOURCE | FLAGS bit 2 set |
| `Modulator.velocity().amount(500).easeIn()` packs correctly | targetProperty=0x00, clamp=1, polarity=0 |
| Inline cursor creates mod entry | MODULATION_TABLE slot populated |
| Built-in shapes: `.centered()` uses LUT slot 1 | PACKED_CFG_B = (0x04 << 24) \| 1 |

### F.8 Expr DSL & Derived Parameters

| Test | Assertion |
|:---|:---|
| `Expr.add(paramA, paramB)` produces correct type | `expr.type === 'add'` |
| Simple expr compiles to single PACKED_CFG_B | Operator=ADD, srcA, srcB packed |
| Complex nested expr uses LUT_POOL slot | COMPLEX flag set, LUT slot index encoded |
| `Param.derive()` sets FLAGS.DERIVED | FLAGS bit 3 set |
| Derived param RAW_VALUE updated after source change | Set A=500, B=300. After evaluateParams(), derived = 800 |
| Circular dependency rejected | `Param.derive(Expr.add(self, B))` throws |
| `.when(Expr.gt(Scene, 500))` gates modulator | Scene=400 → delta=0. Scene=600 → delta=Amount |
| `Expr.toJSON()` round-trips | Parse back, reconstruct, verify identical compilation |
