# Kernel Research Memos

## 1. Captured in RFC-070

The following decisions are fully specified in `docs/rfcs/modulation-v2/RFC-070-modulation-architecture.md`:

- **Modulation architecture**: PARAMETER_TABLE, MODULATION_TABLE, LUT_POOL, SIGNAL_RING
- **SOURCE_MODE**: PARAM (global) vs CONTEXT (per-node via hash+LUT)
- **Hash function**: MurmurHash3 finalizer → `% 256` → LUT index (always through LUT, never direct). Hash-based (not sequential PRNG) because: if you use sequential `prng.next()`, adding a note at the beginning shifts the entire PRNG sequence — every subsequent note gets a different random value. Hash-based `hash(seed, tick, slot)` gives each note a deterministic value based on its identity, not traversal order. Stable under composition edits.
- **Gating**: No threshold/gate attribute fields. GATE modulators with per-instance BASE_VALUE. Additive AND via -1000 deltas
- **Boundaries**: BOUNDARY kind in node chain. Signal-based (SIGNAL_RING), not callbacks. Kernel emits, engine drains. Per-node callbacks rejected due to WASM↔JS crossing cost: 200 nodes × ~150ns per crossing = 30µs per block (~1% of audio budget wasted on no-op round trips). Boundary-only signaling: 2-4 yields per clip = ~600ns. 50× cheaper.
- **Resolvers**: `registerParamResolver` (→ PARAMETER_TABLE), `registerContextResolver` (→ LUT_POOL)
- **Jitter**: tick_offset + SOURCE=CONTEXT modulation. No separate jitter field
- **SynapseAttributePlane**: weight + tick_offset in shared atomic plane, modulatable same as node attributes
- **Deterministic synapses**: All-fire model. Weight = velocity multiplier (integer: `velocity * weight / 1000`). No PRNG
- **View pattern**: All kernel data in AtomicBuffer. Views hold `(mem, mem_start_offset)`, provide typed accessors. No `#[repr(C)]` structs
- **Zero floats in kernel**: All values Q16.16. `compute_phase_increment` runs on bridge only
- **LFO**: Internal parameter source. Audio engine generates RAW_VALUE per block via `generate_waveform()`
- **Expr DSL**: Data structures, not closures. Kernel-compilable. Derived parameters via two-pass evaluation

---

## 2. Decided, Not Yet in RFC-070

These decisions were made in conversation and need to be applied to the next RFC revision.

### Attribute flags reduced to 2 bits

```
bit 0: MUTED     — skip traversal entirely
bit 1: SOLO      — mute everything else
bits 2-31: reserved
```

GHOST_NOTE removed (DSL compiles `.ghost()` to velocity modification). LEGATO_TIE moved to structural plane (it's sequencer control flow: suppress noteOn, extend noteOff). HAS_MODULATORS removed (check `MOD_LIST_HEAD != NULL_PTR` in structural plane instead).

### Channel removed from attribute plane

Instrument routing is determined by synapse graph topology, not a per-note field. A clip is pure sheet music — it doesn't know what plays it. Slot 4 in NodeAttributesView is reserved.

### Expressions / articulations are DSL-level concerns

The kernel does not understand ghost, staccato, accent, marcato, tenuto, sforzando, trill, or tremolo. Every expression reduces to modifications of fundamental note properties (velocity, duration, tick_offset) applied by the DSL builder at composition time. The kernel receives the *result* (integer values), not the *intent*.

| Expression | DSL compilation |
|:---|:---|
| Ghost (melodic) | velocity = low value (builder default) |
| Ghost (drum) | velocity = low value (drum builder may use different default) |
| Staccato | duration shortened (~50% of written) |
| Accent | velocity += delta (builder default ~+200 on 0-1000 scale) |
| Marcato | velocity += larger delta (~+350) |
| Tenuto | duration = full written value (no articulation gap) |
| Sforzando | velocity = near max |
| Trill | Expanded to alternating notes at composition time |
| Tremolo | Expanded to repeated notes at composition time |
| Bypass | TODO — needs clarification. Mentioned alongside SOLO but never defined. Possible meaning: skip modulation evaluation for this node (use base attributes directly) |

Different builders (melodic vs drum) can interpret the same expression differently. The kernel is oblivious.

**DSL builder methods to implement:** `.ghost()`, `.staccato()`, `.accent()`, `.marcato()`, `.tenuto()`, `.sforzando()`, `.bypass()`, `.humanize(amount)`, `.swing(depth)`, `.groove(pattern)`, `.jitter(amount, 'frozen'?)`, `.probability(pct)`, `.threshold(rank, param)`.

`.humanize()` = SOURCE=CONTEXT modulation on velocity (and optionally tick_offset). `.swing()` = per-note tick_offset with SWING_DEPTH parameter scaling. `.groove()` = per-note tick_offset pattern (authored offsets for a feel template).

### Builder-level articulation defaults

Articulation gap (the slight shortening of notes for natural phrasing) is a builder-level default, not a kernel concern:

- **Piano**: ~90% of written duration (percussive, natural decay)
- **Strings (violin)**: ~100% or slight overlap (continuous bow, legato by default)
- **Winds**: ~100% (breath-based, similar to strings)
- **Drums**: no meaningful duration for most hits

Continuous melodies (violin) = contiguous or overlapping durations. The DSP layer handles transitions (glide/portamento for monophonic patches, polyphonic overlap for polyphonic patches).

### EventSink uses target_id, not channel

```rust
fn note_on(&mut self, target_id: u32, pitch: u32, velocity: i32,
           gate_offset: i32, expression_id: u32);
```

`target_id` is derived from synapse routing during graph traversal. The DSP layer maps target_id to the appropriate synthesizer/instrument.

---

## 3. Design Patterns

### Swing depth scaling

Per-note `tick_offset` values encode authored groove (note A pushed +20 ticks, note B pulled -10 ticks). A global parameter `SWING_DEPTH` scales them proportionally:

```
actual_offset = tick_offset * PARAM[SWING_DEPTH].smoothed / 1000
```

- SWING_DEPTH = 0 → all notes snap to grid (quantized)
- SWING_DEPTH = 500 → half swing, tighter feel
- SWING_DEPTH = 1000 → full authored groove

Attach an LFO to SWING_DEPTH → the beat breathes (tightens during verse, loosens during chorus). Each note retains its authored personality; the parameter scales the depth. Global jitter cannot replicate this because it has no per-note personality to scale.

### Density gate (water-level metaphor)

A 16-note pattern where each note has a different GATE modulator BASE_VALUE:

```
Note:       1    2    3    4    5    6    7    8
BASE_VALUE: 100  900  200  800  150  850  250  750
```

One parameter (Density) drives all GATE modulators via `SOURCE=PARAM`:

- Density = 0 → no notes pass → silence
- Density = 200 → only notes with BASE ≤ 200 pass → sparse (notes 1, 3, 5)
- Density = 500 → half the notes pass → medium density
- Density = 1000 → all notes pass → full pattern

Notes "emerge" in a deterministic, authored order as the parameter sweeps. The composer decides which notes appear first (most important beats get low BASE_VALUE). One knob controls rhythmic density. This is how adaptive game soundtracks control percussion intensity.

### Two-layer filtering (density + probability)

Stack two GATE modulators on the same node:

1. **Density gate** (`SOURCE=PARAM`, BASE=700): Does the note's rank pass against the Intensity parameter? (deterministic)
2. **Probability gate** (`SOURCE=CONTEXT`, BASE=400): Does the hash+LUT value pass? (stochastic, ~60% chance)

Both must pass for the note to sound. The kernel evaluates both via the same additive delta mechanism — if either fails, `gate_effective ≤ 0`, note skipped. No special two-layer logic; it falls out of multi-modulator combination.

---

## 4. Composer Architecture

### Cues as Virtual DOM

Cues should return object descriptors (declarative data), not deferred callbacks. A diffing algorithm compares the new descriptor tree against the previous one and applies only the mutations to the kernel. Same principle as React's virtual DOM: declare the desired state, let the framework compute the minimal diff.

**Why:** Avoids redundant kernel writes. If a cue's output hasn't changed between evaluations, no AtomicBuffer mutations occur. Enables efficient re-evaluation when parameters change without full recompilation.

---

## 5. Future Design Space

### Score API (deferred)

DSL sugar for per-note instrument routing without kernel coupling:

```typescript
Score.pipe(
  note('G4').to(Piano),
  note('C4').to(Guitar),
  note('E4').to(Piano, Guitar),              // fan-out
  note('A4').to(PARAM.InstrumentSelector),   // modulated routing
  note('D4').to(lut([Piano, Guitar]).rotate()), // round-robin
)
```

Compiler decomposes to separate clips + synapses at composition time. `.to(PARAM.X)` becomes opposing GATE modulators on parallel synapses. The kernel sees only clips, synapses, and gates — no "Score" concept.

**Deferred because:** clip/track/instrument composition model not yet finalized. RFC-070 needs to NOT have `channel` in the kernel (done), so the design space remains open.

### Quasi-random LUT fills

Van der Corput / Halton sequences as alternatives to pseudo-random LUT fills. Pure function per index, no seed. Mathematically guaranteed even coverage of value space: `vanDerCorput(i)` produces 0.5, 0.25, 0.75, 0.125, 0.625... Could be offered as a built-in context resolver distribution option alongside uniform and gaussian.

**Deferred because:** standard random distributions cover most use cases. Can be added as a LUT fill strategy later without kernel changes.
