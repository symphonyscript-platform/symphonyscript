# RFC-071: Live Coding Architecture

**Status:** Draft  
**Created:** 2026-04-02  
**Depends on:** RFC-070 (Modulation Architecture)  
**Supersedes:** None

---

## 1. Motivation

The original design envisioned two parallel layers: a pre-composed, modulated DSL layer backed by the SAB/kernel, and a separate minimalistic live-coding layer (inspired by Tidal Cycles) backed by a simple command ring bypassing the triple-buffered kernel. This created a conceptual split — two execution models, two data paths, merging only at the audio thread.

This architecture wastes the kernel's capabilities. The triple-buffered structural plane provides O(1) lock-free mutations, snapshot-consistent structural updates, and instant attribute writes — exactly what live coding demands. Building a parallel path around it is putting a Ferrari engine in a go-kart.

**RFC-071 proposes a unified architecture where the live layer sits ON TOP of the composition layer, not alongside it.** The live layer is a control surface that compiles down to the same kernel operations. One kernel, one data path, one set of guarantees.

---

## 2. Core Principle: Three Rates of Change

The unified system expresses all musical change through three temporal granularities, all operating on the same SAB:

| Layer | Granularity | What changes | Mechanism |
|---|---|---|---|
| **Attribute Plane** | Instant (next atomic load) | Pitch, velocity, volume, spatial, etc. | `AtomicI32::store` / `AtomicI32::load` |
| **Modulation** (RFC-070) | Intra-cycle, continuous | Deltas on attributes (smoothed, curved) | Parameter table + mod chain evaluation |
| **Live Layer** (this RFC) | Inter-cycle, at boundaries | Structure, routing, patterns, clip content | Diff → structural mutations → `publish()` |

The composition DSL is the **score**. The modulation system is the **expression**. The live layer is the **conductor**. All three compile down to the same SAB operations.

---

## 3. Architectural Overview

### 3.1 Main Thread as Active Scheduler

The main thread is NOT a write-once composer. It is an **active scheduler** that materializes and publishes structural state every cycle. Write-once composition is a degenerate case (publish once, stop).

```
Main thread role:
  - Owns the cycle clock
  - Evaluates the current live state
  - Materializes node chains for the next cycle
  - Computes tick positions from relative note values
  - Writes to the writer buffer
  - Calls publish()
  - Processes deferred frees from previous cycle
```

### 3.2 Ahead-of-Time Materialization

The main thread stays one cycle ahead of the audio thread. It materializes the NEXT cycle immediately after publishing the current one. If a hot-reload occurs, it re-materializes and re-publishes. The triple buffer's dropped-frame semantics guarantee the audio thread always gets the latest publish.

```
Main thread:                          Audio thread:

materialize cycle 1 → publish
materialize cycle 2 → publish    ←─  audio swaps to cycle 1, plays it
free cycle 0's nodes
[hot-reload detected]
re-materialize cycle 2 → publish ←─  audio swaps to cycle 2, plays it
materialize cycle 3 → publish
free cycle 1's nodes
...
```

The main thread does not poll the audio thread's playback position. It materializes ahead of time and trusts the triple buffer to deliver. The `publish()` memcpy (~4.7µs) is negligible compared to cycle durations (hundreds of milliseconds).

### 3.3 Kernel Independence

The kernel has no concept of live coding, cycles, relative time, or hot-reload. It traverses a graph and fires nodes at tick positions. All live-coding semantics are resolved at the DSL/compiler/scheduler layer, which sits above the kernel and calls the same `insert`, `remove`, `connect`, `disconnect`, `set_attribute`, `publish` operations.

---

## 4. The Cycle Model

### 4.1 Definition

A **cycle** is one full traversal of a `loop` block. The `loop` block defines the performance cycle — the temporal quantum of live coding. Changes snap to cycle boundaries.

### 4.2 Loop Block Semantics

The `loop` block is **syntactic sugar for a cyclic synaptic graph**. Looping emerges from graph topology (a back-edge synapse), not from a special loop opcode or sequencer logic.

```
loop {
    c1
    c2
    c3
}
```

Compiles to:

```
c0 (root clip, implicit)
 └─ sequential synapse → c1
         └─ sequential synapse → c2
                 └─ sequential synapse → c3
                         └─ sequential synapse → c0  (back-edge)
```

The audio thread traverses `c1 → c2 → c3`, hits the back-edge, wraps the playhead (`playhead_tick % cycle_length`), and traverses again. The kernel sees a cyclic directed graph — nothing special about it.

### 4.3 Cycle Duration

Two forms:

- **Implicit (default):** `loop { ... }` — cycle duration = 1 bar at the current global tempo.
- **Explicit:** `loop(2bars) { ... }` — cycle duration specified by the user.

These are complementary. Implicit is concise for the common case. Explicit is the override.

### 4.4 Cycle as Change Boundary

All live mutations (pattern replacement, clip reordering, attribute changes) take effect at the **next cycle boundary**. The main thread queues pending changes and materializes them in the next cycle's publish. The performer knows: "when this loop restarts, my changes land."

---

## 5. Temporal Model: Recursive Proportional Scaling

### 5.1 Relative Time by Default

Inside the live context, all durations are **relative to the enclosing context**. Note values (`4n`, `2n`, `1n`) define proportional ratios, not absolute durations. A `4n` (quarter note) means "1/4 of the available time," not "X milliseconds."

The compiler resolves relative proportions into absolute ticks during materialization. The kernel sees only ticks.

### 5.2 Subdivision Within a Cycle

Sequential clips within a `loop` block subdivide the cycle equally by default:

```
loop {          ← cycle boundary (1000 thousandths)
    c1          ← gets 0..333    (1/3)
    c2          ← gets 333..667  (1/3)
    c3          ← gets 667..1000 (1/3)
}
```

Notes within a clip subdivide the clip's allocation:

```
c3 = kick kick snare snare   (4 events)
      ↓     ↓      ↓      ↓
    667   750    833    917   ← each gets ~83.3 thousandths
```

Explicit weighting overrides equal subdivision:

```
loop {
    c1(500)     ← half the cycle
    c2(250)     ← quarter
    c3(250)     ← quarter
}
```

Grouping provides nested subdivision (analogous to Tidal's bracket notation):

```
loop {
    [c1 c2] c3    ← c1 and c2 share the first half, c3 gets the second half
}
```

### 5.3 Recursive Time Budget Propagation

Time allocation flows through the synaptic graph recursively. Each clip receives a time budget from its parent synapse and distributes it among its own content (notes and child synapses) proportionally.

```
cycle = 3840 ticks
├─ synapse → c1 (gets 1280 ticks)
│   c1's natural duration = 2560 ticks → scale_factor = 1280/2560 = 0.5x
│   ALL content (notes AND children) scales by 0.5x
│   ├─ synapse → c4 (gets its scaled share of c1's 1280)
│   └─ synapse → c5 (gets its scaled share of c1's 1280)
├─ synapse → c2 (gets 1280 ticks)
└─ synapse → c3 (gets 1280 ticks)
```

**Key invariant:** Adding or removing notes from a clip changes the natural duration, which changes the scale factor. All content (notes and children) speeds up or slows down proportionally. More content in the same budget = everything plays faster. Less content = everything plays slower.

### 5.4 Parallel Synapses and Time Allocation

Parallel children receive the **remaining time** of the parent's allocation at their fire point, not the full allocation:

```
Clip c1 (budget: 1000 ticks, natural: 1400, scale: 0.71x):
  A4 4n    → consumes 170 scaled ticks (sequential)
  B4 4n    → consumes 170 scaled ticks (sequential)
  ── parallel fire point ──
  synapse → c4 | parallel  → gets remaining 660 ticks
  synapse → c5 | parallel  → gets same 660 ticks (concurrent)
```

Parallel children play simultaneously and share the same time window. They do not subdivide the remaining time — they each get the full remainder.

---

## 6. Scaling Modes

### 6.1 Definition

A **scaling mode** is a synapse-level (or clip-level) policy that determines how a clip relates to its allocated time budget.

### 6.2 Modes

| Mode | Behavior | Default |
|---|---|---|
| `fit` | Tempo-scale clip content to fill the allocated budget. Proportions preserved. | **Yes** |
| `overflow` | Play at natural/declared tempo. If content exceeds budget, bleed past boundary. | No |
| `truncate` | Play at natural/declared tempo. If content exceeds budget, cut at boundary. | No |

### 6.3 Placement

The scaling mode lives on the **synapse**, not the clip. The same clip can be `fit` in one context and `overflow` in another. The synapse already carries contextual properties (`tempo_scale`, `weight`, `transpose`). `scaling_mode` is a natural addition.

```
SynapseAttributes {
    weight: i32,           // velocity multiplier
    tick_offset: i32,       // timing offset
    transpose: i32,         // pitch shift
    velocity_scale: i32,    // velocity scaling
    scaling_mode: i32,      // 0 = fit (default), 1 = overflow, 2 = truncate
}
```

---

## 7. Tempo vs. Density

### 7.1 Two Rhythmic Dimensions

| Concept | Unit | Nature | Live-coding default |
|---|---|---|---|
| **Density** | Events per cycle | Relative | Yes |
| **Tempo** | BPM | Absolute | No |

### 7.2 Density (Relative)

In the relative model, the number of events and their proportional note values determine rhythm. No explicit tempo declaration is needed. The effective tempo is emergent: `events / allocated_time`.

```
// 4 events in whatever time the parent gives
pattern(kick, snare, kick, hat)
// tempo is NOT declared — it's derived from context
```

### 7.3 Tempo (Absolute, Opt-In)

`tempo(60)` is an **opt-out of relative timing.** It declares: "play at exactly 60 BPM regardless of the budget."

Interaction with scaling modes:
- `tempo(60)` without explicit scaling mode → **implies `scaling('overflow')`**. The clip plays at 60 BPM and bleeds past the boundary if needed.
- `tempo(60)` + `scaling('truncate')` → plays at 60 BPM, hard-cuts at boundary.
- `tempo(60)` + `scaling('fit')` → **fit overrides tempo.** The declared tempo is ignored and the clip scales to fit. Declaring both is contradictory; `fit` wins.
- No `tempo()` declaration → `scaling('fit')` default → fully relative.

**Rule:** `tempo()` is an opt-out of the relative model. It should be discouraged in relative/live contexts but supported for compositional intent that must be preserved.

---

## 8. Live DSL Surface

### 8.1 Live File Structure

The live layer is authored in a separate file (e.g., `live.sym`) that is hot-reloaded on save during live performances. References survive hot-reloads — they point to the same clip instances in the SAB.

```
// live.sym

c1 = ref('c1').instrument(grand_piano)
c2 = ref('c2').instrument(drums)
c3 = ref('c3').instrument(guitar)

c2.tempo(60)   // attribute change on existing clip

loop {
    c1
    c2
    c3
}
```

### 8.2 Live Handles

`ref('name')` resolves to an existing SAB-allocated clip via the `live` binding in the composition DSL:

```
// clip.sym (composition layer)

Clip c1 {
    live c1            // declares this clip as live-addressable under name 'c1'
    tempo 120
    note A4 4n
    note A5 4n
    note A6 4n
    note A7 4n
}
```

The `live` directive creates the binding point. The `ref()` handle in the live layer resolves to the exact SAB slot(s) occupied by this clip's node chain.

### 8.3 Inline Clip Replacement

The live layer supports replacing clips with inline definitions:

```
loop {
    c1
    c2
    clip {
        note F4 4n
        note F5 4n
        note F6 4n
        note F7 4n
    }
}
```

On hot-reload, the diff engine detects the inline clip, allocates new nodes, wires them into the graph, and publishes. The old c3 reference (if any) remains valid but is no longer part of the loop.

### 8.4 Pattern Replacement

**Pattern replacement is the primary live mutation unit.** The performer rewrites the entire pattern, not individual notes. This aligns with Tidal's ergonomics — patterns are short enough that full replacement feels like editing.

```
// Before:
c2.pattern(kick, snare, kick, hat)

// After (hot-reload):
c2.pattern(kick, kick, snare, snare)
```

The diff engine computes the minimal structural mutations (remove old nodes, insert new, rewire chain) and publishes. Attribute-level changes (`c2.instrument(synth)`) are instant writes to the shared attribute plane, no structural mutation needed.

### 8.5 Clip Reordering

```
// Before:
loop { c1, c2, c3 }

// After (hot-reload):
loop { c3, c1, c2 }
```

Reordering compiles to synapse rewiring — `disconnect` old connections, `connect` in new order. O(1) operations per synapse. Changes land at the next cycle boundary.

---

## 9. Pattern Transformations

Pattern transformations are **main-thread operations applied before materialization.** The kernel never sees them — it receives the transformed result as regular nodes with computed ticks.

### 9.1 Core Transformations

| Transform | Semantics | Implementation |
|---|---|---|
| `rev` | Reverse pattern order | Reverse the node array before materializing |
| `fast(n)` | Play pattern n times within the cycle portion | Materialize the pattern n times, each element at 1/n duration |
| `slow(n)` | Pattern spans n cycles; each cycle plays 1/n of the content | Main thread tracks which portion to materialize per cycle |
| `every(n, f)` | Apply transformation `f` every nth cycle | Cycle counter on main thread: `cycle_count % n == 0` |
| `jux(f)` | Apply `f` to one stereo channel | Two parallel clips: one original, one transformed, panned opposite |

### 9.2 Cycle-Counting State

Transformations like `slow` and `every` require cycle counting. This state lives on the **main thread** in a map keyed by loop/pattern identifier:

```rust
struct LiveSchedulerState {
    cycle_counts: HashMap<PatternId, u64>,
    // ...
}
```

Incremented at each cycle boundary. Not stored on the SAB — it's scheduler-internal state with no audio-thread visibility.

---

## 10. Diff Engine

### 10.1 Purpose

On hot-reload, the diff engine compares the previous live state against the new state and emits the minimal set of kernel operations to transition between them.

### 10.2 Diff Granularity

| Change type | Kernel operations | Cost |
|---|---|---|
| Attribute change (`c2.volume(80)`) | `AttributePlane::set()` | Instant, no publish needed |
| Pattern replacement (`c2.pattern(...)`) | `remove` old nodes, `insert` new nodes, rewire chain | Structural, requires publish |
| Clip reordering (`loop { c3, c1, c2 }`) | `disconnect` + `connect` synapses | Structural, requires publish |
| Inline clip addition | `alloc` nodes, `insert` into chain, `connect` synapses | Structural, requires publish |
| Clip removal from loop | `disconnect` synapses, `deferred_free` nodes | Structural, requires publish |

### 10.3 Diff Strategy

**V1 (recommended):** Full clip-level replacement. On pattern change, free all old nodes and allocate new ones. Simple, correct, and fast enough — replacing 16 nodes is microseconds with the free list.

**V2 (optimization):** Node-level diffing. Compare old and new patterns element-by-element. If only one note's pitch changed, update the attribute plane (no structural change). If a note was inserted/removed, perform minimal chain surgery. More complex, deferred to later.

---

## 11. Polymetric Loops

### 11.1 Multiple Concurrent Loops

The system supports multiple independent loops with different cycle lengths:

```
loop(3beats) { kick hat kick }    // 3/4 time
loop(4beats) { snare . snare . }  // 4/4 time
```

Each loop is a separate cyclic subgraph in the same SAB. The main thread maintains independent cycle clocks and materializes each loop independently. The audio thread traverses all active chains within each audio block.

### 11.2 Implementation

Each loop has its own:
- Cycle clock (cycle count, cycle duration)
- Root clip node (head of the cyclic chain)
- Publish cadence (independent per loop)

The triple buffer contains ALL loops' structural data in a single consistent snapshot. One `publish()` commits all pending changes across all loops atomically.

---

## 12. Interaction with Modulation (RFC-070)

### 12.1 Complementary, Not Competing

Modulation and live coding operate at different temporal granularities:
- **Modulation:** Continuous, intra-cycle parameter changes. Evaluated during audio-thread traversal.
- **Live coding:** Discrete, inter-cycle structural changes. Applied at cycle boundaries by the main thread.

### 12.2 Modulation Survives Pattern Replacement

When a clip's pattern is replaced (nodes freed, new nodes allocated), modulators attached to the old nodes are **destroyed and freed** along with the nodes. The new pattern starts with no modulators unless explicitly reattached.

Modulators attached to the **clip's parameter table entries** (global parameters, not per-node) survive pattern replacement because the parameter table is part of the attribute plane, not the structural plane.

### 12.3 Live Modulation Control

The live layer can adjust modulation parameters in real-time through the attribute plane:

```
c2.mod(Intensity).amount(500)   // instant attribute write
c2.mod(LFO).rate(200)           // instant attribute write
```

These are attribute writes, not structural mutations. No publish needed. Effective immediately (next atomic load by the audio thread).

---

## 13. Offline Export Compatibility

### 13.1 Deterministic Execution

The same live script, executed with the same initial clip state and the same sequence of hot-reloads, produces bit-identical output. The kernel is deterministic (hash-based stochastic functions, no PRNG), and the main thread's cycle clock produces identical tick sequences regardless of real-time vs. offline execution.

### 13.2 Offline Mode

Offline export runs the same cycle-boundary materialization in a tight loop:

```
while not_finished {
    materialize_next_cycle();
    publish();
    render_audio_block();    // write to file instead of DAC
    advance_cycle_clock();
}
```

The only difference from live mode: the cycle clock advances as fast as the CPU allows, and hot-reloads are replaced by a deterministic event log.

---

## 14. Contract: Key Interfaces

The following signatures define the contract between the live layer and the kernel. These are the public interfaces the live scheduler calls. Implementation is not specified.

### 14.1 Live Scheduler

```rust
pub struct LiveScheduler {
    kernel_writer: KernelWriter,
    cycle_clock: CycleClock,
    live_state: LiveState,
    pending_changes: PendingChanges,
    cycle_counts: HashMap<LoopId, u64>,
}

impl LiveScheduler {
    /// Create a new scheduler bound to a kernel writer.
    pub fn new(kernel_writer: KernelWriter, default_cycle_duration: TickDuration) -> Self;

    /// Advance by one cycle: apply pending changes, materialize, publish.
    pub fn advance_cycle(&mut self);

    /// Queue a hot-reload diff for application at the next cycle boundary.
    pub fn apply_hot_reload(&mut self, new_state: LiveState);

    /// Register a loop with an explicit cycle duration.
    pub fn register_loop(&mut self, id: LoopId, duration: TickDuration) -> LoopHandle;

    /// Get the current cycle count for a loop.
    pub fn cycle_count(&self, id: LoopId) -> u64;
}
```

### 14.2 Cycle Clock

```rust
pub struct CycleClock {
    cycle_duration_ticks: u64,
    current_tick: u64,
    cycle_count: u64,
}

impl CycleClock {
    pub fn new(cycle_duration_ticks: u64) -> Self;

    /// Advance by one cycle. Returns the tick range for the next cycle.
    pub fn advance(&mut self) -> TickRange;

    /// Reset cycle duration (e.g., on tempo change).
    pub fn set_duration(&mut self, ticks: u64);
}
```

### 14.3 Diff Engine

```rust
pub struct DiffEngine;

impl DiffEngine {
    /// Compare two live states and produce a set of kernel mutations.
    pub fn diff(old: &LiveState, new: &LiveState) -> Vec<KernelMutation>;
}

pub enum KernelMutation {
    InsertNode { clip_id: ClipId, position: usize, draft: NodeDraft },
    RemoveNode { clip_id: ClipId, slot: usize },
    ReplacePattern { clip_id: ClipId, new_pattern: Vec<NodeDraft> },
    ReorderClips { loop_id: LoopId, new_order: Vec<ClipId> },
    SetAttribute { slot: usize, attribute: AttributeId, value: i32 },
    ConnectSynapse { source: SlotId, target: SlotId, data: SynapseDraft },
    DisconnectSynapse { synapse_slot: SlotId },
}
```

### 14.4 Pattern Compiler

```rust
pub struct PatternCompiler;

impl PatternCompiler {
    /// Convert relative pattern notation into absolute tick positions.
    /// Takes a pattern (sequence of relative note values) and a time budget,
    /// returns node drafts with computed base_tick values.
    pub fn compile(
        pattern: &[PatternEvent],
        budget_ticks: u64,
        scaling_mode: ScalingMode,
    ) -> Vec<NodeDraft>;
}

pub enum ScalingMode {
    Fit,        // default: scale to fill budget
    Overflow,   // play at natural tempo, bleed past budget
    Truncate,   // play at natural tempo, cut at budget
}

pub struct PatternEvent {
    pub note: NoteValue,         // e.g., A4
    pub duration: RelDuration,   // e.g., 4n, 2n, 1n (proportional)
    pub attributes: Vec<(AttributeId, i32)>,
}
```

### 14.5 Live Handle Resolution

```rust
pub struct LiveHandleRegistry {
    handles: HashMap<String, ClipHandle>,
}

impl LiveHandleRegistry {
    /// Register a clip as live-addressable.
    pub fn register(&mut self, name: &str, handle: ClipHandle);

    /// Resolve a live reference to its clip handle.
    pub fn resolve(&self, name: &str) -> Option<&ClipHandle>;
}

pub struct ClipHandle {
    pub head_slot: SlotId,          // head node of the clip's chain
    pub node_slots: Vec<SlotId>,    // all node slots in the clip
    pub synapse_slots: Vec<SlotId>, // all synapse slots owned by the clip
}
```

---

## 15. Non-Goals (Explicitly Out of Scope)

1. **DSL syntax design.** The exact syntax of the live DSL (mini-notation, pattern combinators, grouping operators) is a separate design effort. This RFC defines the architecture, not the language.

2. **Hot-reload transport mechanism.** How file changes are detected and delivered to the scheduler (file watcher, WebSocket, IPC) is an implementation concern.

3. **Voice management.** Polyphonic voice allocation, sustain, release — these are DSP-layer concerns. The kernel emits `noteOn`/`noteOff` events; the DSP layer handles the rest.

4. **Visual feedback.** UI updates showing current cycle position, active patterns, or fire traces are outside this RFC.

5. **Kernel modifications.** This RFC requires NO changes to the kernel's structural plane, attribute plane, triple buffer, or free list implementations.

---

## 16. Summary of Design Decisions

| Decision | Resolution | Rationale |
|---|---|---|
| Live layer placement | On top of composition layer, not parallel | Reuses kernel's O(1) operations; one data path |
| Main thread role | Active scheduler, publishes every cycle | Enables live mutation; write-once is degenerate case |
| Cycle definition | One traversal of the `loop` block | Global synchronization point; changes snap here |
| Loop implementation | Syntactic sugar for cyclic synaptic graph | Looping emerges from topology, not special opcodes |
| Time model | Recursive proportional scaling | Preserves note ratios; composes hierarchically |
| Default scaling | `fit` (tempo-scale to fill budget) | Most intuitive for live-coding; Tidal-equivalent |
| Tempo declaration | Opt-out of relative timing; implies `overflow` | Absolute timing is explicit, not default |
| Pattern mutation | Full pattern replacement (V1) | Simple, correct; node-level diff deferred |
| Modulator fate | Destroyed with old nodes on replacement | Clean slate; parameter-table mods survive |
| Change timing | Applied at next cycle boundary | Predictable, glitch-free transitions |
| Offline export | Same code path, faster clock | Bit-identical to live execution |
