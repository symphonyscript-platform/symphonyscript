# RFC-058: Immutable Composition Layer

**Status:** Draft (Revision 3)
**Depends on:** None (prerequisite for RFC-050)
**Supersedes:** RFC-049 (Synaptic Cursor Architecture), RFC-058 Revisions 1–2

---

## 1. Abstract

This RFC defines the composition layer architecture for SymphonyScript. It replaces the current eager, mutable, cursor-based model with a **pipe-first, functional, immutable** model.

A single `Clip` type holds a pipeline of `PipeStep` functions. All musical operations — notes, chords, drums, transforms, MIDI events — are **standalone functions** passed to `Clip.pipe()`. There are no separate clip types, no cursors, and no escape pattern. Formatter-safe commas delimit operations.

Two bridge interfaces separate concerns: `IBridge` (low-level, stateless, kernel-facing) and `ICompositionBridge` (high-level, fully immutable, pipe-facing). Composition is **100% pure** — zero side effects until `.commit(bridge)` is called. `ICompositionBridge` accumulates deferred thunks via `withNote()`, `withCC()`, etc. Side effects (SAB writes, serialization, recording) happen only at commit time, against any `IBridge` implementation. Structural sharing via linked list makes immutable cloning O(1).

---

## 2. Motivation

### 2.1 Problems with the Current Architecture

The current composition layer (`SynapticClip`, `SynapticMelody`, `SynapticDrums`) has five problems:

**1. Eager SAB writes.** Every `.note()` call immediately writes to the kernel via `bridge.insertAsync()`. Unused clips (loaded but never played) pollute the node heap.

**2. Mutable state.** Clips accumulate state internally (`currentTick`, `velocity`, `transpose`). This creates ordering dependencies, aliasing bugs, and makes hot-swap during live-coding dangerous. Composing the same clip into two different parents causes state interference.

**3. Cursor ambiguity.** After `.note('C4')`, the developer is on a cursor. Is `.flat()` a cursor method or a clip method? Is the next `.note('E4')` an escape from the cursor or a direct clip call? The answer depends on indentation discipline and mental gymnastics — both fragile.

**4. Bridge as constructor dependency.** Clips require a `SiliconBridge` at construction time, coupling composition to the kernel. Testing, serialization, and introspection require workarounds.

**5. Formatter hostility.** Fluent chains like `.note('C4').velocity(800).note('E4')` depend on manual indentation to communicate grouping. Prettier destroys this by reflowing chains into arbitrary line widths.

### 2.2 Why Pipe, Not Fluent Cursors

The cursor-based fluent API appears elegant in examples but creates real problems at scale:

**Ambiguity.** In `.note('C4').flat().velocity(600).sustain().chord('Am').drop2()`, which methods belong to the note cursor and which to the clip? Without reading type signatures, it's impossible to tell. With pipe:

```typescript
Clip.pipe(
  note('C4').flat().velocity(600),   // clearly one note, configured
  sustain(),                          // clearly a separate event
  chord('Am').drop2(),               // clearly one chord, configured
)
```

Commas are unambiguous delimiters. Builder methods (`.flat()`, `.velocity()`, `.drop2()`) are clearly attached to the thing they modify — they're on the same expression, before the comma.

**Formatter safety.** `Clip.pipe(arg, arg, arg)` is a standard function call. Every formatter — Prettier, ESLint, Biome — handles it correctly: one argument per line, trailing comma, consistent indentation. Zero configuration.

**Extensibility.** Adding new operations to a fluent API requires modifying interfaces and implementations. Adding new operations to a pipe API requires exporting a function. Community extensions are first-class — anyone can publish pipe-compatible functions:

```typescript
import { palmMute, harmonic } from '@symphonyscript/guitar';
Clip.pipe(note('E2'), palmMute(), note('E4'), harmonic())
```

**No escape pattern.** Cursors need escape methods (`.note()` on a cursor implicitly commits and creates a new note) to avoid mandatory `.commit()` calls. This requires every cursor implementation to mirror all parent clip methods — 40+ methods duplicated per cursor type, all invisible in the interface. With pipe, there are no cursors, so there's no escape complexity.

**Simplified type system.** The cursor model requires: `IClip<T, S>`, `IMelodyClip<S>`, `IDrumClip<S>`, `INoteCursor<S>`, `IChordCursor<S>`, `IDrumHitCursor<S>`, `ILinkCursor<T, S>` — 7 generic interfaces with phantom types threading through. The pipe model requires: `Clip`, `ICompositionBridge`, `IPipeCompatible` — 3 types. The phantom type for serializability moves to builders where it's simpler.

### 2.3 Why Clips Are Sheet Music

Clips are descriptions of **what to play**, not **how to play it**. Like sheet music, they contain notes, rests, dynamics, tempo markings, and performance annotations (sustain pedal, breath marks, pitch bend). They don't know which instrument will perform them.

This means:
- No `IKeyboardClip`, `IWindClip`, `IStringClip`. Those are instrument concerns.
- Instrument-specific markings (`sustain()`, `breath()`, `bend()`) are standalone functions wrapping `addCC()` / `addBend()`. Available to any clip.
- A drum part is just notes on percussion MIDI pitches. `kick()` = `note(36)` with a name.
- The instrument layer (Track/Session) interprets these markings during binding.

One `Clip` type. All musical vocabulary is in standalone functions.

---

## 3. Architecture Overview

### 3.1 Lifecycle

```
Standalone functions: note(), chord(), kick(), humanize(), etc.
  ↓
Clip.pipe(step1, step2, step3, ...)  — builds pipeline
  ↓
clip.materialize(compositionBridge)  — executes pipeline
  ↓
ICompositionBridge delegates to IBridge — SAB writes / serialization / recording
  ↓
Runtime — Kernel is sole source of truth. Modulation drives expression.
```

### 3.2 The Pipe

`Clip.pipe()` accepts any number of `PipeStep` functions and `IPipeCompatible` builders. It composes them sequentially into a single pipeline:

```typescript
type PipeStep = (bridge: ICompositionBridge) => ICompositionBridge;

interface IPipeCompatible {
  commit(): PipeStep;
}

const clip = Clip.pipe(
  note('C4').flat(),           // IPipeCompatible (NoteBuilder)
  note('E4').velocity(600),    // IPipeCompatible (NoteBuilder)
  humanize(0.1),               // PipeStep (raw function)
  chord('Am').drop2(),         // IPipeCompatible (ChordBuilder)
  sustain(),                   // PipeStep (raw function)
);
```

`pipe()` auto-detects: builders get `.commit()` called, raw functions pass through:

```typescript
class Clip {
  static pipe(...steps: (PipeStep | IPipeCompatible)[]): Clip {
    const resolved = steps.map(s =>
      typeof s === 'function' ? s : s.commit()
    );
    return new Clip(resolved);
  }
}
```

### 3.3 Full Purity — Zero Side Effects During Composition

`ICompositionBridge` is **fully pure**. `withNote()` does not write to any bridge — it returns a new `ICompositionBridge` with the note **deferred as a thunk**. No side effects until `.commit(bridge)` is called.

```
Composition (pure):     pipe steps call withNote(), withCC(), with*() → accumulate thunks
                                        ↓
Commit (side effects):  compositionBridge.commit(kernelBridge)      → thunks execute
                        compositionBridge.commit(serializationBridge) → JSON capture
                        compositionBridge.commit(recordingBridge)     → note recording
```

The same composed bridge can be committed to **multiple targets** without re-running the pipe. Compose once, commit many.

This is safe because pipe functions execute at **construction time** on the main thread — not at playback time on the audio thread. Object allocation at construction time is free.

Full purity enables:
- **Transactional semantics.** If a pipe step throws, nothing is written. Discard the bridge — free rollback.
- **`stack()` branching.** Both branches receive the same bridge — each returns its own fork. No snapshot/restore needed.
- **Clip reuse.** Same clip materialized N times. No state leakage between materializations.
- **Debugging.** Each step produces a snapshot. Trace the full state history.
- **Optimization window.** Between composition and commit, thunks can be sorted, deduplicated, or batched.

---

## 4. Bridge Architecture

### 4.1 Why Two Interfaces

The composition layer and the kernel have fundamentally different needs:

| Concern | Kernel needs | Composition needs |
|:---|:---|:---|
| Parameters | All explicit (pitch, vel, dur, tick) | Implicit from state (tick, velocity auto-injected) |
| State | None — stateless write target | Immutable state tracking (tick, vel, transpose, ...) |
| Side effects | Immediate (SAB writes) | Deferred (thunks accumulated, committed later) |
| Consumers | `.commit()` only | Pipe steps (the public API) |

Merging these into one interface would either expose low-level methods to pipe steps (allowing kernel writes during composition) or force the kernel to carry composition state (unnecessary coupling). Two interfaces, separated:

### 4.2 `IBridge` — Low-Level Write Interface

Stateless. All parameters explicit. Implemented by kernel-facing bridges. **Not visible to pipe steps.**

```typescript
interface IBridge {
  /** Insert a note node. Returns node pointer or error code. */
  insertNote(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    muted: boolean,
    sourceId: number,
    exitId?: number,
    expressionId?: number
  ): number;

  /** Insert MIDI CC event. */
  insertCC(controller: number, value: number, tick: number, sourceId: number): number;

  /** Insert pitch bend event. */
  insertBend(value: number, tick: number, sourceId: number): number;

  /** Create synapse connection. */
  connect(srcId: number, tgtId: number, weight?: number): void;

  /** Remove synapse connection. */
  disconnect(srcId: number, tgtId: number): void;

  /** Mark node for reclamation. */
  reclaim(nodePtr: number): void;

  /** Get PPQ resolution. */
  getPpq(): number;
}
```

### 4.3 `IBridge` Implementations

| Implementation | Purpose |
|:---|:---|
| `KernelBridge` | Writes to SAB via `Atomics` for runtime playback |
| `SerializationBridge` | Captures operations as JSON / blob / protobuf |
| `RecordingBridge` | Captures note data for `FrozenClip` and tests |

### 4.4 `ICompositionBridge` — High-Level Composition Interface

Fully immutable. Zero side effects. What pipe steps interact with. **Does NOT extend `IBridge`.**

All `with*` methods return a new `ICompositionBridge`. Event methods (`withNote`, `withCC`, `withBend`) accumulate deferred thunks — they do NOT write to any bridge. Side effects happen only at `.commit()` time.

```typescript
interface ICompositionBridge {

  // === Readonly State ===

  readonly tick: number;
  readonly velocity: number;
  readonly transpose: number;
  readonly defaultDuration: number;
  readonly tempo: number;
  readonly timeSignatureNum: number;
  readonly timeSignatureDen: number;
  readonly scaleRoot: number;
  readonly scaleMode: ScaleMode;
  readonly swing: number;

  // === Deferred Event Methods (pure — accumulate thunks, no side effects) ===

  /** Defer a note. Uses tick/velocity from state unless overridden. Returns new bridge with advanced tick + thunk appended. */
  withNote(pitch: number, duration?: number, velocity?: number): ICompositionBridge;

  /** Defer a MIDI CC at current tick. */
  withCC(controller: number, value: number): ICompositionBridge;

  /** Defer a pitch bend at current tick. */
  withBend(value: number): ICompositionBridge;

  // === Deferred Topology (pure — accumulate thunks) ===

  /** Defer a synapse connection. */
  withConnect(srcId: number, tgtId: number, weight?: number): ICompositionBridge;

  /** Defer a synapse disconnection. */
  withDisconnect(srcId: number, tgtId: number): ICompositionBridge;

  /** Defer a node reclamation. */
  withReclaim(nodePtr: number): ICompositionBridge;

  // === Immutable State Modifiers (pure — return new bridge with updated state) ===

  /** Return new bridge with specified velocity. */
  withVelocity(v: number): ICompositionBridge;

  /** Return new bridge with specified transpose offset. */
  withTranspose(s: number): ICompositionBridge;

  /** Return new bridge with specified default duration. */
  withDefaultDuration(d: number): ICompositionBridge;

  /** Return new bridge with specified tempo. */
  withTempo(bpm: number): ICompositionBridge;

  /** Return new bridge with specified time signature. */
  withTimeSignature(num: number, den: number): ICompositionBridge;

  /** Return new bridge with specified scale context. */
  withScale(root: string, mode: ScaleMode): ICompositionBridge;

  /** Return new bridge with specified key context. */
  withKey(root: string, mode: ScaleMode): ICompositionBridge;

  /** Return new bridge with specified swing amount (0.0–1.0). */
  withSwing(amount: number): ICompositionBridge;

  /** Return new bridge with quantize settings. */
  withQuantize(grid: number, strength?: number): ICompositionBridge;

  /** Return new bridge with specified tick position. */
  withTick(tick: number): ICompositionBridge;

  /** Return new bridge with muted flag. */
  withMuted(muted: boolean): ICompositionBridge;

  /** Return new bridge with precise flag (skip humanization). */
  withPrecise(precise: boolean): ICompositionBridge;

  // === Commit (side effects — execute all accumulated thunks) ===

  /** Execute all accumulated thunks against the provided bridge. */
  commit(bridge: IBridge): void;
}
```

### 4.5 Structural Sharing via Linked List

With full immutability, every `withNote()` / `withVelocity()` / etc. creates a new bridge instance. Naively copying the thunk list would be O(n) per operation and O(n²) total memory.

Instead, `CompositionBridge` uses a **persistent linked list** for thunks. Each new instance holds a pointer to the previous instance's thunk node — adding a thunk is O(1), sharing is automatic:

```typescript
// Linked list node for thunks
interface ThunkNode {
  readonly thunk: (bridge: IBridge) => void;
  readonly prev: ThunkNode | null;
}

class CompositionBridge implements ICompositionBridge {
  constructor(
    readonly tick: number = 0,
    readonly velocity: number = 800,
    readonly transpose: number = 0,
    readonly defaultDuration: number = 1,
    // ... all state fields
    private readonly _head: ThunkNode | null = null,
    private readonly _length: number = 0,
  ) {}

  withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    const dur = duration ?? this.defaultDuration;
    const vel = velocity ?? this.velocity;
    const finalPitch = pitch + this.transpose;
    const tick = this.tick;
    // Capture all values in closure — pure, deferred
    const thunk = (bridge: IBridge) => {
      bridge.insertNote(finalPitch, vel, dur, tick, false, 0);
    };
    return this.derive(
      { tick: this.tick + dur },
      { thunk, prev: this._head }  // O(1) — just prepend
    );
  }

  withVelocity(v: number): CompositionBridge {
    return this.derive({ velocity: v }); // no thunk added
  }

  commit(bridge: IBridge): void {
    // Collect thunks in order (linked list is reversed)
    const thunks: ((bridge: IBridge) => void)[] = [];
    let node = this._head;
    while (node) {
      thunks.push(node.thunk);
      node = node.prev;
    }
    thunks.reverse();
    // Execute in composition order
    for (const thunk of thunks) {
      thunk(bridge);
    }
  }

  private derive(
    stateOverrides: Partial<CompositionBridgeState>,
    newHead?: ThunkNode
  ): CompositionBridge {
    return new CompositionBridge(
      stateOverrides.tick ?? this.tick,
      stateOverrides.velocity ?? this.velocity,
      stateOverrides.transpose ?? this.transpose,
      stateOverrides.defaultDuration ?? this.defaultDuration,
      // ...
      newHead ?? this._head,
      newHead ? this._length + 1 : this._length,
    );
  }
}
```

**Why linked list, not array:**

| Operation | Array (copy-on-write) | Linked list |
|:---|:---|:---|
| `withNote()` (append) | O(n) copy | O(1) prepend |
| `withVelocity()` (state only) | O(1) | O(1) |
| `stack()` fork | O(n) copy | O(1) — both branches share the same tail |
| `commit()` | O(n) iterate | O(n) collect + iterate |
| Memory for n notes | O(n²) worst case (copies) | O(n) — shared tails |

The linked list gives O(1) forking for `stack()` — both branches share the common prefix. Only their divergent thunks are unique. This is the same structural sharing pattern used by persistent data structures in Clojure and Immutable.js.

### 4.6 Transform Decorators

Transforms implement `ICompositionBridge` and wrap another `ICompositionBridge`. They intercept `withNote()` and transform parameters before delegating. Note operations never know about transforms — the bridge handles everything.

```typescript
class HumanizingBridge implements ICompositionBridge {
  constructor(
    private readonly inner: ICompositionBridge,
    private readonly velAmount: number,
    private readonly timingAmount: number,
    private readonly rng: SeededRandom
  ) {}

  withNote(pitch: number, duration?: number, velocity?: number): ICompositionBridge {
    const vel = (velocity ?? this.velocity) + jitter(this.velAmount, this.rng);
    const tickOffset = jitter(this.timingAmount, this.rng);
    return this.inner.withTick(this.tick + tickOffset).withNote(pitch, duration, vel);
  }

  // All with*() and state accessors delegate to this.inner
  withVelocity(v: number): ICompositionBridge {
    return new HumanizingBridge(this.inner.withVelocity(v), this.velAmount, this.timingAmount, this.rng);
  }

  commit(bridge: IBridge): void {
    this.inner.commit(bridge);  // delegate
  }

  get tick(): number { return this.inner.tick; }
  get velocity(): number { return this.inner.velocity; }
  // ... all state delegated
}
```

Available decorators:

| Decorator | Intercepts | Transform |
|:---|:---|:---|
| `HumanizingBridge` | `withNote()` | Jitter velocity and timing |
| `QuantizingBridge` | `withNote()` | Snap tick to grid |
| `SwingBridge` | `withNote()` | Offset offbeat ticks |
| `DynamicsBridge` | `withNote()` | Scale velocity over time range |
| `TransposingBridge` | `withNote()` | Shift pitch by semitones |

---

## 5. Standalone Operations

All musical operations are standalone functions grouped by namespace for discoverability.

### 5.1 Organizaton

```typescript
// Individual imports
import { note, chord, rest, degree, roman } from '@symphonyscript/melody';
import { kick, snare, hihat, crash, ride } from '@symphonyscript/drums';
import { humanize, transpose, swing, quantize } from '@symphonyscript/fx';
import { sustain, release, breath, bend } from '@symphonyscript/instrument';

// Namespace imports
import { Melody, Drums, Fx, Instrument } from '@symphonyscript/core';
```

### 5.2 Melody Operations

```typescript
/** Single note. Returns NoteBuilder for configuration. */
function note(pitch: string | number, duration?: number): NoteBuilder;

/** Scale degree. Requires withScale() context on bridge. */
function degree(deg: number, duration?: number): NoteBuilder;

/** Chord by symbol (e.g., "Am", "C7", "Dm9"). Returns ChordBuilder. */
function chord(symbol: string): ChordBuilder;

/** Chord from scale degrees. Requires withScale() context. */
function degreeChord(degrees: number[], duration?: number): ChordBuilder;

/** Chord from roman numeral. Requires withKey() context. */
function roman(numeral: string, duration?: number): ChordBuilder;

/** Emit chord progression from roman numerals. */
function progression(numerals: string[], duration?: number): PipeStep;

/** Voice-led chord progression (minimizes voice movement). */
function voiceLead(numerals: string[], duration?: number): PipeStep;

/** Arpeggiate pitches. */
function arpeggio(pitches: (string | number)[], rate: number, pattern?: ArpPattern, octaves?: number): PipeStep;

/** Euclidean rhythm with notes. */
function euclidean(hits: number, steps: number, notes: (string | number)[], stepDuration: number, rotation?: number): PipeStep;

/** Binary step pattern. 1 = play, 0 = rest. */
function steps(pattern: number[], notes: (string | number)[], stepDuration: number): PipeStep;

/** Polyrhythm: n notes evenly spaced over m beats. */
function polyrhythm(notes: number, overBeats: number, fn: (bridge: ICompositionBridge) => ICompositionBridge): PipeStep;

/** Trill between current pitch and target. */
function trill(pitch: string | number, rate: number, duration: number): PipeStep;

/** Grace note before the next main note. */
function grace(pitch: string | number): NoteBuilder;

/** Glissando (pitch slide). */
function glissando(from: string | number, to: string | number, duration: number): PipeStep;

/** Rapid repeated note. */
function tremolo(pitch: string | number, rate: number, duration: number): PipeStep;

/** Tuplet time (e.g., triplet: count=3, inBeats=2). */
function tuplet(count: number, inBeats: number, fn: (bridge: ICompositionBridge) => ICompositionBridge): PipeStep;

/** Advance tick without emitting a note. */
function rest(duration: number): PipeStep;

/** MIDI CC at current tick. */
function cc(controller: number, value: number): PipeStep;

/** Pitch bend at current tick. */
function pitchBend(value: number): PipeStep;

/** Aftertouch at current tick. */
function aftertouch(value: number, note?: string | number): PipeStep;
```

### 5.3 Drum Operations

```typescript
function kick(duration?: number): DrumHitBuilder;
function snare(duration?: number): DrumHitBuilder;
function hihat(duration?: number): DrumHitBuilder;
function openHat(duration?: number): DrumHitBuilder;
function clap(duration?: number): DrumHitBuilder;
function tom(n: number, duration?: number): DrumHitBuilder;
function crash(duration?: number): DrumHitBuilder;
function ride(duration?: number): DrumHitBuilder;
function rim(duration?: number): DrumHitBuilder;
function cowbell(duration?: number): DrumHitBuilder;
function shaker(duration?: number): DrumHitBuilder;

/** Any named percussion sound. */
function hit(name: string, duration?: number): DrumHitBuilder;

/** Text pattern. 'x' = hit, '.' = rest, '-' = sustain. */
function drumPattern(notation: string, stepDuration?: number): PipeStep;

/** Euclidean drum rhythm. */
function drumEuclidean(hits: number, steps: number, stepDuration?: number, rotation?: number): PipeStep;

/** Binary drum step pattern. */
function drumSteps(pattern: number[], stepDuration: number): PipeStep;

/** Flam: two rapid hits. */
function flam(hitName?: string): DrumHitBuilder;

/** Drag: three rapid hits. */
function drag(hitName?: string): DrumHitBuilder;

/** Buzz roll. */
function roll(duration: number, rate?: number): PipeStep;
```

### 5.4 Transform Operations (Fx)

```typescript
/** Enable humanization. Wraps bridge with HumanizingBridge. */
function humanize(velocity: number, timing?: number): PipeStep;

/** Transpose subsequent notes. Wraps bridge with TransposingBridge. */
function transpose(semitones: number): PipeStep;

/** Apply swing timing. */
function swing(amount: number): PipeStep;

/** Snap to grid. */
function quantize(grid: number, strength?: number): PipeStep;

/** Gradual velocity increase. */
function crescendo(duration: number, from?: number, to?: number): PipeStep;

/** Gradual velocity decrease. */
function decrescendo(duration: number, from?: number, to?: number): PipeStep;

/** Set base velocity for subsequent notes. */
function velocity(v: number): PipeStep;

/** Set default duration for notes that don't specify one. */
function defaultDuration(beats: number): PipeStep;

/** Set tempo. */
function tempo(bpm: number): PipeStep;

/** Set time signature. */
function timeSignature(num: number, den: number): PipeStep;

/** Set scale context. */
function scale(name: string): PipeStep;

/** Set key context. */
function key(root: string, mode: ScaleMode): PipeStep;

/** Set octave. */
function octave(n: number): PipeStep;

/** Shift up by n octaves. */
function octaveUp(n?: number): PipeStep;

/** Shift down by n octaves. */
function octaveDown(n?: number): PipeStep;

/** Disable humanization for subsequent notes. */
function precise(): PipeStep;

/** Set probability for the next note (0.0–1.0). */
function chance(probability: number): PipeStep;

/** Reverse content (operates on completed clip when used as clip method). */
function reverse(): PipeStep;

/** Time-stretch by factor. */
function stretch(factor: number): PipeStep;
```

### 5.5 Instrument Markings

Named wrappers around `cc()` and `pitchBend()`. Any clip can use them — the instrument layer interprets them at binding time.

```typescript
/** Sustain pedal on (CC64 = 127). */
function sustain(): PipeStep;

/** Sustain pedal off (CC64 = 0). */
function release(): PipeStep;

/** Breath controller (CC2). Amount 0–1. */
function breath(amount: number): PipeStep;

/** Expression controller (CC11). Amount 0–1. */
function expression(amount: number): PipeStep;

/** Mod wheel (CC1). Amount 0–1. */
function modWheel(amount: number): PipeStep;

/** Pitch bend in semitones (-12 to +12). */
function bend(semitones: number): PipeStep;

/** Reset pitch bend to center. */
function bendReset(): PipeStep;
```

### 5.6 Composition Operations

```typescript
/** Insert another clip's content at current tick. */
function play(clip: Clip): PipeStep;

/** Execute branches in parallel at the same tick. */
function stack(...branches: PipeStep[]): PipeStep;

/** Repeat a clip or builder function. */
function loop(count: number, source: Clip | PipeStep): PipeStep;

/** Repeat previous step n times. */
function repeat(n: number, step: PipeStep | IPipeCompatible): PipeStep;

/** Execute in MPE voice scope. */
function voice(id: number, fn: (bridge: ICompositionBridge) => ICompositionBridge): PipeStep;
```

---

## 6. Builders

Builders configure multi-property events. They implement `IPipeCompatible` — `pipe()` auto-calls `.commit()`. All builder methods are immutable (return new builder).

### 6.1 `NoteBuilder`

Returned by `note()`, `degree()`, `grace()`.

```typescript
class NoteBuilder implements IPipeCompatible {
  // Configuration (each returns new NoteBuilder)
  velocity(v: number): NoteBuilder;
  duration(d: number): NoteBuilder;
  pitch(p: string | number): NoteBuilder;
  flat(): NoteBuilder;
  sharp(): NoteBuilder;
  natural(): NoteBuilder;

  // Articulation
  legato(): NoteBuilder;
  staccato(factor?: number): NoteBuilder;
  accent(amount?: number): NoteBuilder;
  ghost(amount?: number): NoteBuilder;
  tenuto(): NoteBuilder;
  marcato(): NoteBuilder;
  precise(): NoteBuilder;

  // Expression
  bend(amount: number): NoteBuilder;
  slide(toPitch: string | number): NoteBuilder;

  // Modulation (RFC-050)
  mod(param: IParam): ModulatorBuilder;

  // Produce PipeStep
  commit(): PipeStep;
}
```

### 6.2 `ChordBuilder`

Returned by `chord()`, `degreeChord()`, `roman()`.

```typescript
class ChordBuilder implements IPipeCompatible {
  // Properties
  velocity(v: number): ChordBuilder;
  duration(d: number): ChordBuilder;

  // Voicing
  inversion(n: number): ChordBuilder;
  drop2(): ChordBuilder;
  drop3(): ChordBuilder;
  open(): ChordBuilder;
  close(): ChordBuilder;

  // Strumming
  strum(rate: number, direction?: 'up' | 'down'): ChordBuilder;
  spread(amount: number): ChordBuilder;

  // Articulation
  accent(amount?: number): ChordBuilder;
  ghost(amount?: number): ChordBuilder;
  staccato(factor?: number): ChordBuilder;
  legato(): ChordBuilder;

  // Modulation (RFC-050)
  mod(param: IParam): ModulatorBuilder;

  // Produce PipeStep
  commit(): PipeStep;
}
```

### 6.3 `DrumHitBuilder`

Returned by `kick()`, `snare()`, `hihat()`, etc.

```typescript
class DrumHitBuilder implements IPipeCompatible {
  velocity(v: number): DrumHitBuilder;
  duration(d: number): DrumHitBuilder;
  ghost(amount?: number): DrumHitBuilder;
  accent(amount?: number): DrumHitBuilder;
  flam(): DrumHitBuilder;
  drag(): DrumHitBuilder;
  precise(): DrumHitBuilder;

  // Modulation (RFC-050)
  mod(param: IParam): ModulatorBuilder;

  // Produce PipeStep
  commit(): PipeStep;
}
```

### 6.4 `LinkBuilder`

Returned by `Clip.use(target)`.

```typescript
class LinkBuilder implements IPipeCompatible {
  weight(w: number): LinkBuilder;
  mod(param: IParam): ModulatorBuilder;

  // Conditional (dual mode)
  when(expr: IExpr): LinkBuilder;
  when(fn: (value: number) => boolean): LinkBuilder;  // taints serializability

  // Produce PipeStep
  commit(): PipeStep;
}
```

---

## 7. The `Clip` Class

Minimal. The entire public API is ~6 methods:

```typescript
class Clip {
  /** Create a clip from pipe steps. Auto-commits IPipeCompatible builders. */
  static pipe(...steps: (PipeStep | IPipeCompatible)[]): Clip;

  /** Execute pipeline against a composition bridge. Returns composed bridge (with accumulated thunks). */
  materialize(bridge: ICompositionBridge): ICompositionBridge;

  /** Snapshot clip output into a FrozenClip for composition-time reuse. */
  freeze(): IFrozenClip;

  /** Create synapse to target clip. Returns LinkBuilder. */
  use(target: Clip, weight?: number): LinkBuilder;

  /** Set loop region boundaries. */
  setLoopRegion(start: number, end: number): Clip;

  /** Reverse content (post-processing via RecordingBridge). */
  reverse(): Clip;

  /** Time-stretch content by factor. */
  stretch(factor: number): Clip;
}
```

`materialize()` runs the pipe steps, returning an `ICompositionBridge` with all thunks accumulated. Call `.commit(bridge)` to execute:

### 7.1 `IFrozenClip`

```typescript
interface IFrozenClip {
  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void
  ): void;
  readonly noteCount: number;
  readonly duration: number;
}
```

---

## 8. Serializability

### 8.1 Phantom Types on Builders

Since builders can accept arrow functions (`.when(v => v > 500)`), serializability tracking moves to builders:

```typescript
class LinkBuilder<S extends Serializable | Unserializable = Serializable> {
  when(expr: IExpr): LinkBuilder<S>;                   // preserves S
  when(fn: (value: number) => boolean): LinkBuilder<Unserializable>;  // taints
}
```

### 8.2 Serialization Flow

```typescript
// Compose (pure — no side effects)
const bridge = new CompositionBridge();
const composed = clip.materialize(bridge);

// Commit to kernel (side effects — SAB writes)
composed.commit(new KernelBridge(sab));

// Commit to serializer (side effects — JSON capture)
const serializer = new SerializationBridge();
composed.commit(serializer);
const json = serializer.toJSON();

// Commit to recorder (side effects — note capture for freeze/tests)
const recorder = new RecordingBridge();
composed.commit(recorder);
const frozen = recorder.toFrozenClip();
```

Compose once, commit many. The same composed bridge can be committed to any number of `IBridge` targets.

---

## 9. Live-Coding Model

### 9.1 Tier 1: Parameter Modulation (99%)

Clips are materialized once. Runtime expressiveness comes from RFC-050 modulation:
- Synapse weight routing (which clips play)
- Velocity/pitch/volume/tempo modulation (how they sound)
- Crossfade (smooth transitions via opposing weight modulators)
- Parametric pitches via derived parameters

No clip re-evaluation needed.

### 9.2 Tier 2: Immutable Hot-Swap (< 1%)

Module re-evaluates → new immutable clip → materialize → reclaim old nodes → resynapse.

```typescript
const newClip = Clip.pipe(note('D4'), note('F#4'), note('A4'));
session.replace(oldClip, newClip);  // reclaim + materialize + resynapse
```

Atomic. No diffing, no partial updates — old clip is a value, new clip is a value. Swap the reference.

### 9.3 Tier 3: Direct Note-On (< 0.1%)

Real-time keyboard input bypasses composition entirely:

```typescript
bridge.fireNoteOn(channelId, pitch, velocity);
bridge.fireNoteOff(channelId, pitch);
```

Direct to DSP via `CMD.DIRECT_NOTE_ON`. No SAB node. No clip.

---

## 10. Full Example

```typescript
import { note, chord, rest, degree } from '@symphonyscript/melody';
import { kick, snare, hihat, crash } from '@symphonyscript/drums';
import { humanize, transpose, velocity, scale, key, tempo } from '@symphonyscript/fx';
import { sustain, release } from '@symphonyscript/instrument';
import { Clip } from '@symphonyscript/core';

// Melody clip
const verse = Clip.pipe(
  tempo(120),
  key('C', 'major'),
  velocity(700),
  humanize(50, 10),

  sustain(),
  chord('Am').drop2().duration(2),
  chord('F').open().duration(2),
  release(),

  note('C4').legato(),
  note('E4'),
  note('G4').accent(),
  rest(0.5),

  degree(1).staccato(),
  degree(3),
  degree(5).velocity(900),
);

// Drum clip
const beat = Clip.pipe(
  velocity(800),
  humanize(30, 5),

  kick(),
  hihat().ghost(),
  snare().accent(),
  hihat(),
  kick(),
  kick(),
  snare(),
  hihat().ghost(),
);

// Wiring
const song = Clip.pipe();
song.use(verse, 1000);
song.use(beat, 1000);
```

---

## 11. Migration Plan

### Phase 1: Interfaces + Types

Define `IBridge`, `ICompositionBridge`, `PipeStep`, `IPipeCompatible`. No implementation changes.

### Phase 2: CompositionBridge + Decorators

Implement `CompositionBridge` with structural sharing (linked list). Implement transform decorators (`HumanizingBridge`, etc.). No kernel dependency.

### Phase 3: Standalone Functions

Implement all standalone functions (`note()`, `chord()`, `kick()`, etc.) and builders (`NoteBuilder`, `ChordBuilder`, `DrumHitBuilder`).

### Phase 4: Clip Class

New `Clip` class with `pipe()`, `materialize()`, `freeze()`, `use()`. Deprecate `SynapticClip`, `SynapticMelody`, `SynapticDrums`.

### Phase 5: Remove Legacy

Delete old clip classes, cursors, builders. All composition goes through `Clip.pipe()`.

---

## Appendix A: Decision Log

| # | Decision | Rationale |
|:---|:---|:---|
| 1 | Pipe-first, functional core | Zero ambiguity. Commas delimit. Formatter-safe. Extensible via functions |
| 2 | No separate clip types | Clips are sheet music, not instruments. One `Clip` type |
| 3 | No cursors | Replaced by standalone builders. No escape pattern complexity |
| 4 | All operations are standalone functions | Tree-shakeable. Community-extensible. Import-based discoverability |
| 5 | `IBridge` and `ICompositionBridge` are separate (no inheritance) | Different concerns: stateless I/O vs fully deferred composition. Type system enforces boundary |
| 6 | `ICompositionBridge` is fully pure | Zero side effects during composition. Thunks deferred until `.commit(bridge)` |
| 7 | `.commit(bridge)` executes accumulated thunks | Polymorphic: kernel, serialization, recording. Compose once, commit many |
| 8 | Transforms are ICompositionBridge decorators | Each concern isolated. Note operations don't know about transforms |
| 9 | `with*` prefix for ALL methods | State modifiers AND event methods: `withVelocity()`, `withNote()`, `withCC()`. Uniform immutable API |
| 10 | Builders implement IPipeCompatible | pipe() auto-commits. Clean separation: configure then execute |
| 11 | `.use()` for synapse creation | Short, natural: "clip uses another clip" |
| 12 | Instrument markings are standalone functions | `sustain()`, `breath()`, `bend()` — named wrappers around cc/pitchBend |
| 13 | Pipe steps never access IBridge directly | Type system prevents kernel writes during composition |
| 14 | Construction-time execution, not playback | Pipe runs on main thread. Allocations are free. Kernel is sole runtime truth |
| 15 | Clips are reusable, stay alive after materialization | Materialize N times into N different bridges |
| 16 | Namespaced exports for discoverability | `Melody.note()`, `Drums.kick()`, `Fx.humanize()` — IDE autocomplete |
| 17 | Structural sharing via persistent linked list | O(1) thunk append, O(1) fork for `stack()`, O(n) shared tails |
| 18 | Transactional composition | If pipe step throws, nothing is written. Discard bridge = free rollback |
| 19 | Compose once, commit many | Same thunk list committed to kernel, serializer, recorder independently |
| 20 | RFC-058 lands before RFC-050 | Composition layer is the foundation modulation sits on |
