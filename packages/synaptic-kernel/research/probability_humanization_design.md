# Probability, Humanization & Seed Design — Summary

## Core Mechanism: Hash-Based Per-Node Noise

The kernel computes a deterministic noise value per node using MurmurHash3 finalizer:

```rust
fn noise(seed: u32, tick: u32, slot: u32) -> u32 {
    let mut h = seed ^ tick.wrapping_mul(0x9E3779B9) ^ slot.wrapping_mul(0x517CC1B7);
    h ^= h >> 16;
    h = h.wrapping_mul(0x85EBCA6B);
    h ^= h >> 13;
    h = h.wrapping_mul(0xC2B2AE35);
    h ^= h >> 16;
    h % 1000
}
```

- Inputs: `seed` (from AtomicBuffer header or clip-local), `tick` (absolute playhead), `slot` (node/synapse index)
- Output: 0–999, uniformly distributed
- Pure integer math — identical results in Rust and JS (`Math.imul` for wrapping multiply)
- No LUT, no boundary callbacks, no external filling

---

## Two Attribute Fields: Threshold + Probability

| Field | Compared against | Default (always plays) | Semantics |
|---|---|---|---|
| `threshold` | Modulated param value | 0 | Density gate (water-level metaphor) |
| `probability` | [hash(seed, tick, slot)](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic-kernel/src/primitives/hash_table/probe_hash_table.rs#74-78) | 1000 | Random gate (per-note chance) |

**Both must pass** (AND-gating) for a note to fire.

```typescript
note('G4')
  .threshold(700)      // plays when Density param > 700
  .probability(500)    // ...and only 50% of the time
```

- `threshold = 0` → density gate disabled (always passes)
- `probability = 1000` → random gate disabled (always passes)
- Kernel skips both checks when at defaults (flag-guarded)

Both fields exist on **nodes AND synapses** (SynapseAttributePlane).

---

## Humanization: NOISE_HASH Curve Type

A new `CurveType` in the modulator's `PACKED_CFG_B` for per-node continuous variation.

**Simple case** — no Param, fixed depth:
```typescript
note('G4').humanize(30)
// → CurveType=NOISE_HASH, Amount=30, bipolar, paramId=NONE
// kernel: delta = hash(seed, tick, slot) * 30 / 1000
```

**Advanced case** — Param controls depth:
```typescript
const Feel = Param.create(PARAM.Feel).smooth(0.9)
note('G4').humanize(30, Feel)
// → CurveType=NOISE_HASH, Amount=30, bipolar, paramId=Feel
// kernel: delta = paramValue * hash(seed, tick, slot) * 30 / (1000 * 1000)
```

- `paramId = NONE` → kernel treats depth as 1000 (full)
- `paramId` set → Param acts as a depth knob (sweep Feel 0→1000 to introduce humanization live)
- Replaces composition-time humanization — one mechanism covers both static and dynamic cases

---

## Seed Management

**Global default**: `NOISE_SEED` in AtomicBuffer header. Default `0`. Writable by bridge: `bridge.setSeed(value)`.

**Clip-local seed**: `seed()` node at the start of a clip's chain.

```typescript
Clip.pipe(
  seed(42),                   // deterministic — same outcome every playback
  note('G4').probability(70),
)

Clip.pipe(
  seed(PARAM.Entropy),        // reads param value at traversal time
  note('G4').probability(70), // different outcome when param changes
)
```

**Scoping**: No push/pop kinds. The sequencer's clip traversal context naturally saves/restores the seed when entering/leaving a clip chain. Clips without a `seed()` node inherit the parent's seed (or global default at root).

**Non-deterministic seeds**: Main thread writes to `PARAM.Entropy` via `setParam()`, timer, sensor input, etc. `seed(PARAM.Entropy)` reads the current value when the clip starts. Timing imprecision from main thread is irrelevant — entropy doesn't need precision.

---

## SynapseAttributePlane

Modulatable synapse fields live in a shared atomic plane (not triple-buffered):

```
SynapseAttributePlane per slot: [weight, tick_offset, threshold, probability, _reserved, ...]
```

- `weight`: velocity multiplier (0–1000). Weight > 0 fires. Weight = 0 skips.
- `tick_offset`: timing offset. Modulated = jitter. Static = authored groove.
- `threshold`: density gate, same as nodes.
- `probability`: random gate, same as nodes.

All instantly patchable via atomic stores. No [publish()](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic-kernel/src/primitives/triple_buffer.rs#146-161) needed.

---

## Synaptic Weight Semantics (Deterministic Model)

- **All synapses with weight > 0 fire** — no PRNG selection, no single-winner
- **Weight = velocity multiplier**: `effectiveVelocity = noteVelocity × weight / 1000`
- **Weight = 1000** (default): full velocity pass-through
- **Weight = 0**: clip skipped entirely — zero DSP cost
- **Stochastic behavior**: achieved via `probability` field on synapse, not weight
- **Hebbian learning**: moved to application layer. Main thread reads fire trace, runs learning algorithm, writes updated weights via `setParam()`. Kernel is pure.
- **Name stays `weight`** — fits the synaptic metaphor that IS the product

---

## What We Decided Against

| Concept | Why rejected |
|---|---|
| **LUT-based noise** | Requires filling, boundary callbacks, dummy params. Hash is simpler. |
| **SCATTER flag** | Architectural duct tape — conflates LUT lookup with per-node identity. Hash replaces it. |
| **Boundaries (for now)** | Every concrete use case (seed rotation, LUT refresh, param updates) handled by simpler mechanisms. Additive if needed later. |
| **Composition-time humanize** | Redundant — NOISE_HASH covers both static and dynamic cases. |
| **Separate jitter field** | `tick_offset` + modulation = jitter. One field, two behaviors. |
| **Stochastic self-evolving weights** | Non-reproducible, non-debuggable. Deterministic weights + external learning loop is strictly more general. |
| **SEED_PUSH/SEED_POP kinds** | Clip traversal context handles scoping naturally. No explicit stack management. |

---

## Updated Node Attribute Fields

```
 0  pitch
 1  velocity
 2  duration
 3  volume
 4  channel
 5  flags
 6  spatial_x
 7  spatial_y
 8  spatial_z
 9  detune
10  tick_offset
11  threshold
12  probability
13–15  _reserved (pad to 16 for alignment)
```

Stride: 16 × i32 = 64 bytes = one cache line.
