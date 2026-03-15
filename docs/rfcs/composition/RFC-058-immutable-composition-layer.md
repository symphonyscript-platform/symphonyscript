# RFC-058: Immutable Composition Layer

**Status:** Implemented (Revision 4)
**Depends on:** None (prerequisite for RFC-050)
**Supersedes:** RFC-049 (Synaptic Cursor Architecture), RFC-058 Revisions 1–2

---

## 1. Abstract

This RFC defines the composition layer architecture for SymphonyScript. It replaces the current eager, mutable, cursor-based model with a **pipe-first, functional, immutable** model.

A single `Clip` type holds a pipeline of `PipeStep` objects. All musical operations — notes, chords, drums, transforms, MIDI events — are **standalone functions** called **notations**, passed to `Clip.pipe()`. There are no separate clip types, no cursors, and no escape pattern. Formatter-safe commas delimit operations.

Two bridge interfaces separate concerns: `ExecutionContext` (low-level, stateless, kernel-facing) and `CompositionBridge` (high-level, fully immutable, pipe-facing). Composition is **100% pure** — zero side effects until `.commit(bridge)` is called. `CompositionBridge` accumulates deferred thunks via `withNote()`, `withCC()`, etc. Side effects (SAB writes, serialization, recording) happen only at commit time, against any `ExecutionContext` implementation. Structural sharing via linked list makes immutable cloning O(1).

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

**Simplified type system.** The cursor model requires: `IClip<T, S>`, `IMelodyClip<S>`, `IDrumClip<S>`, `INoteCursor<S>`, `IChordCursor<S>`, `IDrumHitCursor<S>`, `ILinkCursor<T, S>` — 7 generic interfaces with phantom types threading through. The pipe model requires: `Clip`, `CompositionBridge`, `PipeStep` — 3 types. The phantom type for serializability moves to builders where it's simpler.

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
clip.compose(compositionBridge)  — executes pipeline
  ↓
CompositionBridge delegates to ExecutionContext — SAB writes / serialization / recording
  ↓
Runtime — Kernel is sole source of truth. Modulation drives expression.
```

### 3.2 The Pipe

`Clip.pipe()` accepts any number of `PipeStep` objects. Every operation — builders and simple transforms alike — implements `PipeStep`:

```typescript
/** All pipe arguments implement this. One method. One interface. */
interface PipeStep {
  apply(bridge: CompositionBridge): CompositionBridge;
}

/** Helper for simple operations that don't need builder configuration. */
function step(fn: (bridge: CompositionBridge) => CompositionBridge): PipeStep {
  return { apply: fn };
}
```

Usage — every argument is `PipeStep`, uniform type:

```typescript
const clip = Clip.pipe(
  note('C4').flat(),           // PipeStep (NoteBuilder)
  note('E4').velocity(600),    // PipeStep (NoteBuilder)
  humanize(0.1),               // PipeStep (via step() helper)
  chord('Am').drop2(),         // PipeStep (ChordBuilder)
  sustain(),                   // PipeStep (via step() helper)
);
```

`pipe()` is trivial:

```typescript
class Clip {
  static pipe(...steps: PipeStep[]): Clip {
    return new Clip(steps);
  }

  compose(bridge: CompositionBridge): CompositionBridge {
    let b = bridge;
    for (const s of this.steps) {
      b = s.apply(b);
    }
    return b;
  }
}
```

### 3.3 Full Purity — Zero Side Effects During Composition

`CompositionBridge` is **fully pure**. `withNote()` does not write to any bridge — it returns a new `CompositionBridge` with the note **deferred as a thunk**. No side effects until `.commit(bridge)` is called.

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
- **Clip reuse.** Same clip composed N times. No state leakage between compositions.
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

### 4.2 `ExecutionContext` — Low-Level Write Interface

Stateless. All parameters explicit. Implemented by kernel-facing bridges. **Not visible to pipe steps.**

```typescript
interface ExecutionContext {
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

### 4.3 `ExecutionContext` Implementations

| Implementation | Purpose |
|:---|:---|
| `KernelBridge` | Writes to SAB via `Atomics` for runtime playback |
| `SerializationBridge` | Captures operations as JSON / blob / protobuf |
| `RecordingBridge` | Captures note data for `FrozenClip` and tests |

### 4.4 `CompositionBridge` — High-Level Composition Interface

Fully immutable. Zero side effects. What pipe steps interact with. **Does NOT extend `ExecutionContext`.**

All `with*` methods return a new `CompositionBridge`. Event methods (`withNote`, `withCC`, `withBend`) accumulate deferred thunks — they do NOT write to any bridge. Side effects happen only at `.commit()` time.

```typescript
interface CompositionBridge {

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
  readonly keyRoot: number;
  readonly keyMode: ScaleMode;
  readonly swing: number;
  readonly muted: boolean;
  readonly precise: boolean;
  readonly quantizeGrid: number;
  readonly quantizeStrength: number;

  // === Deferred Event Methods (pure — accumulate thunks, no side effects) ===

  /** Defer a note. Uses tick/velocity from state unless overridden. Returns new bridge with advanced tick + thunk appended. */
  withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge;

  /** Defer a MIDI CC at current tick. */
  withCC(controller: number, value: number): CompositionBridge;

  /** Defer a pitch bend at current tick. */
  withBend(value: number): CompositionBridge;

  // === Deferred Topology (pure — accumulate thunks) ===

  /** Defer a synapse connection. */
  withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge;

  /** Defer a synapse disconnection. */
  withDisconnect(srcId: number, tgtId: number): CompositionBridge;

  /** Defer a node reclamation. */
  withReclaim(nodePtr: number): CompositionBridge;

  // === Immutable State Modifiers (pure — return new bridge with updated state) ===

  /** Return new bridge with specified velocity. */
  withVelocity(v: number): CompositionBridge;

  /** Return new bridge with specified transpose offset. */
  withTranspose(s: number): CompositionBridge;

  /** Return new bridge with specified default duration. */
  withDefaultDuration(d: number): CompositionBridge;

  /** Return new bridge with specified tempo. */
  withTempo(bpm: number): CompositionBridge;

  /** Return new bridge with specified time signature. */
  withTimeSignature(num: number, den: number): CompositionBridge;

  /** Return new bridge with specified scale context. */
  withScale(root: string, mode: ScaleMode): CompositionBridge;

  /** Return new bridge with specified key context. */
  withKey(root: string, mode: ScaleMode): CompositionBridge;

  /** Return new bridge with specified swing amount (0.0–1.0). */
  withSwing(amount: number): CompositionBridge;

  /** Return new bridge with quantize settings. */
  withQuantize(grid: number, strength?: number): CompositionBridge;

  /** Return new bridge with specified tick position. */
  withTick(tick: number): CompositionBridge;

  /** Return new bridge with muted flag. */
  withMuted(muted: boolean): CompositionBridge;

  /** Return new bridge with precise flag (skip humanization). */
  withPrecise(precise: boolean): CompositionBridge;

  // === Commit (side effects — execute all accumulated thunks) ===

  /** Execute all accumulated thunks against the provided bridge. */
  commit(bridge: ExecutionContext): void;
}
```

### 4.5 Structural Sharing via Linked List

With full immutability, every `withNote()` / `withVelocity()` / etc. creates a new bridge instance. Naively copying the thunk list would be O(n) per operation and O(n²) total memory.

Instead, `CompositionBridge` uses a **persistent linked list** for thunks. Each new instance holds a pointer to the previous instance's thunk node — adding a thunk is O(1), sharing is automatic:

```typescript
// Linked list node for thunks
interface ThunkNode {
  readonly thunk: (bridge: ExecutionContext) => void;
  readonly prev: ThunkNode | null;
}

class CompositionBridge implements CompositionBridge {
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
    const thunk = (bridge: ExecutionContext) => {
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

  commit(bridge: ExecutionContext): void {
    // Collect thunks in order (linked list is reversed)
    const thunks: ((bridge: ExecutionContext) => void)[] = [];
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

Transforms implement `CompositionBridge` and wrap another `CompositionBridge`. They intercept `withNote()` and transform parameters before delegating. Note operations never know about transforms — the bridge handles everything.

```typescript
class HumanizingBridge implements CompositionBridge {
  constructor(
    private readonly inner: CompositionBridge,
    private readonly velAmount: number,
    private readonly timingAmount: number,
    private readonly rng: SeededRandom
  ) {}

  withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    const vel = (velocity ?? this.velocity) + jitter(this.velAmount, this.rng);
    const tickOffset = jitter(this.timingAmount, this.rng);
    return this.inner.withTick(this.tick + tickOffset).withNote(pitch, duration, vel);
  }

  // All with*() and state accessors delegate to this.inner
  withVelocity(v: number): CompositionBridge {
    return new HumanizingBridge(this.inner.withVelocity(v), this.velAmount, this.timingAmount, this.rng);
  }

  commit(bridge: ExecutionContext): void {
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

## 5. Notations

All musical operations are standalone functions called **notations**. Each notation returns a `PipeStep`. Notations are grouped by namespace for discoverability.

### 5.1 Organization

```typescript
// Individual imports
import { note, chord, rest, degree, roman } from '@symphonyscript/notations/melody';
import { kick, snare, hihat, crash, ride } from '@symphonyscript/notations/drums';
import { humanize, transpose, swing, quantize } from '@symphonyscript/notations/fx';
import { sustain, release, breath, bend } from '@symphonyscript/notations/instrument';

// Namespace imports
import { Melody, Drums, Fx, Instrument } from '@symphonyscript/notations';
```

### 5.2 Melody Notations

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
function polyrhythm(notes: number, overBeats: number, fn: (bridge: CompositionBridge) => CompositionBridge): PipeStep;

/** Trill between current pitch and target. */
function trill(pitch: string | number, rate: number, duration: number): PipeStep;

/** Grace note before the next main note. */
function grace(pitch: string | number): NoteBuilder;

/** Glissando (pitch slide). */
function glissando(from: string | number, to: string | number, duration: number): PipeStep;

/** Rapid repeated note. */
function tremolo(pitch: string | number, rate: number, duration: number): PipeStep;

/** Tuplet time (e.g., triplet: count=3, inBeats=2). */
function tuplet(count: number, inBeats: number, fn: (bridge: CompositionBridge) => CompositionBridge): PipeStep;

/** Advance tick without emitting a note. */
function rest(duration: number): PipeStep;

/** MIDI CC at current tick. */
function cc(controller: number, value: number): PipeStep;

/** Pitch bend at current tick. */
function pitchBend(value: number): PipeStep;

/** Aftertouch at current tick. */
function aftertouch(value: number, note?: string | number): PipeStep;
```

### 5.3 Drum Notations

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

### 5.4 Transform & Effect Notations (Fx)

Effect notations return `ScopeBuilder`s that support both scoped and cascading modes:

```typescript
/** Enable humanization. Wraps bridge with HumanizingBridge. */
function humanize(velocity: number, timing?: number): HumanizationBuilder;

/** Apply swing timing. */
function swing(amount: number): SwingBuilder;

/** Snap to grid. */
function quantize(grid: number, strength?: number): QuantizationBuilder;

/** Apply groove template. */
function groove(probability: number): GrooveBuilder;

/** Mute probability. */
function chance(probability: number): ChanceBuilder;

/** Gradual velocity increase. */
function crescendo(duration: number, from?: number, to?: number): CrescendoBuilder;

/** Gradual velocity decrease. */
function decrescendo(duration: number, from?: number, to?: number): DecrescendoBuilder;

/** Reverse content. */
function reverse(): ReverseBuilder;

/** Time-stretch by factor. */
function stretch(factor: number): StretchBuilder;

/** Compose multiple effects into one scope. */
function scoped(...effects: PipeStep[]): ScopedBuilder;

/** Full context isolation — state changes inside don't leak out. */
function isolate(): IsolateBuilder;
```

### 5.4b Setter Notations

Setters return `FieldSetter` (extends `ScopedSetterBuilder`) — support both cascading and `.steps()` scoped modes:

```typescript
// Cascading (sets value downstream):
tempo(140)

// Scoped (auto-restores after):
tempo(140).steps(note('C4'), note('D4'))
```

All setter notations:

```typescript
function transpose(semitones: number): FieldSetter;
function velocity(value: number): FieldSetter;
function tempo(bpm: number): FieldSetter;
function scale(root: PitchClass, mode: ScaleMode): FieldSetter;
function key(root: PitchClass, mode: ScaleMode): FieldSetter;
function defaultDuration(duration: number): FieldSetter;
function timeSignature(num: number, den: number): FieldSetter;
function octave(n: number): FieldSetter;
function precise(): FieldSetter;
function volume(value: number): FieldSetter;
function pan(value: number): FieldSetter;

// Relative (non-scoped, plain PipeStep):
function octaveUp(n?: number): PipeStep;
function octaveDown(n?: number): PipeStep;
```

### 5.5 Instrument Notations

Named wrappers around `cc()` and `pitchBend()`. Any clip can use them — the instrument layer interprets them at binding time.

```typescript
/** Sustain pedal on (CC64 = 127). */
function sustain(): PipeStep;

/** Sustain pedal off (CC64 = 0). */
function release(): PipeStep;

/** Breath controller (CC2). Amount 0–127. */
function breath(amount: number): PipeStep;

/** Expression controller (CC11). Amount 0–127. */
function expression(amount: number): PipeStep;

/** Mod wheel (CC1). Amount 0–127. */
function modWheel(amount: number): PipeStep;

/** Pitch bend (scoped — auto-resets after steps). */
function bend(value?: number): BendBuilder;

/** Reset pitch bend to center. */
function bendReset(): PipeStep;
```

### 5.6 Composition Notations

```typescript
/** Insert another clip's content at current tick. */
function use(clip: Composable): PipeStep;

/** Execute branches in parallel at the same tick. */
function stack(): StackBuilder;

/** Repeat a clip or builder function. */
function loop(count: number, source: Clip | PipeStep): PipeStep;

/** Repeat previous step n times. */
function repeat(n: number, source: PipeStep): PipeStep;
```

---

## 6. Builders

Builders configure multi-property events. They implement `PipeStep` — `pipe()` calls `.apply()` during materialization. All builder methods are immutable (return new builder).

### 6.1 `NoteBuilder`

Returned by `note()`, `degree()`, `grace()`.

```typescript
class NoteBuilder implements PipeStep {
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

  // PipeStep implementation
  apply(bridge: CompositionBridge): CompositionBridge;
}
```

### 6.2 `ChordBuilder`

Returned by `chord()`, `degreeChord()`, `roman()`.

```typescript
class ChordBuilder implements PipeStep {
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

  // PipeStep implementation
  apply(bridge: CompositionBridge): CompositionBridge;
}
```

### 6.3 `DrumHitBuilder`

Returned by `kick()`, `snare()`, `hihat()`, etc.

```typescript
class DrumHitBuilder implements PipeStep {
  velocity(v: number): DrumHitBuilder;
  duration(d: number): DrumHitBuilder;
  ghost(amount?: number): DrumHitBuilder;
  accent(amount?: number): DrumHitBuilder;
  flam(): DrumHitBuilder;
  drag(): DrumHitBuilder;
  precise(): DrumHitBuilder;

  // Modulation (RFC-050)
  mod(param: IParam): ModulatorBuilder;

  // PipeStep implementation
  apply(bridge: CompositionBridge): CompositionBridge;
}
```

### 6.4 `LinkBuilder`

Returned by `Clip.use(target)`.

```typescript
class LinkBuilder implements PipeStep {
  weight(w: number): LinkBuilder;
  mod(param: IParam): ModulatorBuilder;

  // Conditional (dual mode)
  when(expr: IExpr): LinkBuilder;
  when(fn: (value: number) => boolean): LinkBuilder;  // taints serializability

  // PipeStep implementation
  apply(bridge: CompositionBridge): CompositionBridge;
}
```

---

## 7. Clip

### 7.1 `IClip` — The Interface

> **Note:** `IClip` is an intentional exception to the "no I-prefix" convention. The `Clip` name is reserved for the class that serves as both implementation and static factory. The I-prefix avoids a name collision while keeping `Clip` as the single developer-facing name.

```typescript
interface IClip {
  pipe(...steps: PipeStep[]): IClip
  compose(context: CompositionBridge): CompositionBridge
}
```

Two methods. All other operations (`use()`, `reverse()`, `stretch()`, `setLoopRegion()`) are notations or session-level concerns.

### 7.2 `Clip` — The Class

`Clip` is both the static entry point and the `IClip` implementation. Internally it uses a persistent linked list of `PipeStepNode` groups for structural sharing across `pipe()` calls:

```typescript
interface PipeStepNode {
  readonly steps: PipeStep[]
  readonly prev: PipeStepNode | null
}

class Clip implements IClip {
  constructor(private readonly tail: PipeStepNode | null = null) {}

  static pipe(...steps: PipeStep[]): Clip {
    return new Clip({ prev: null, steps })
  }

  static freeze(clip: IClip): FrozenClip {
    return freeze(clip)
  }

  pipe(...steps: PipeStep[]): Clip {
    return new Clip({ prev: this.tail, steps })
  }

  compose(context: CompositionBridge): CompositionBridge {
    let current = this.tail
    let bridge = context
    const nodes: PipeStepNode[] = []

    while (current) {
      nodes.push(current)
      current = current.prev
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      const steps = nodes[i].steps
      for (let j = 0; j < steps.length; ++j) {
        bridge = steps[j].apply(bridge)
      }
    }

    return bridge
  }
}
```

- `Clip.pipe()` — static factory. Creates a `Clip` with a single node (no prev).
- `clip.pipe()` — instance method. Creates a new `Clip` with the new steps prepended, sharing the existing tail. O(1).
- `clip.compose()` — collects linked list nodes, reverses to chronological order, applies all steps.
- `Clip.freeze()` — static utility. Composes against a fresh `CompositionBridge`, commits to a `RecordingBridge`, returns `FrozenClip`.

### 7.3 `FrozenClip`

```typescript
interface FrozenClip {
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
const composed = clip.compose(bridge);

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

Compose once, commit many. The same composed bridge can be committed to any number of `ExecutionContext` targets.

---

## 9. Live-Coding Model

### 9.1 Tier 1: Parameter Modulation (99%)

Clips are composed once. Runtime expressiveness comes from RFC-050 modulation:
- Synapse weight routing (which clips play)
- Velocity/pitch/volume/tempo modulation (how they sound)
- Crossfade (smooth transitions via opposing weight modulators)
- Parametric pitches via derived parameters

No clip re-evaluation needed.

### 9.2 Tier 2: Immutable Hot-Swap (< 1%)

Module re-evaluates → new immutable clip → compose → reclaim old nodes → resynapse.

```typescript
const newClip = Clip.pipe(note('D4'), note('F#4'), note('A4'));
session.replace(oldClip, newClip);  // reclaim + compose + resynapse
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
import { note, chord, rest, degree } from '@symphonyscript/notations/melody';
import { kick, snare, hihat, crash } from '@symphonyscript/notations/drums';
import { humanize, transpose, velocity, scale, key, tempo } from '@symphonyscript/notations/fx';
import { sustain, release } from '@symphonyscript/notations/instrument';
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

Define `ExecutionContext`, `CompositionBridge`, `PipeStep`. No implementation changes.

### Phase 2: CompositionBridge + Decorators

Implement `CompositionBridge` with structural sharing (linked list). Implement transform decorators (`HumanizingBridge`, etc.). No kernel dependency.

### Phase 3: Standalone Functions

Implement all standalone functions (`note()`, `chord()`, `kick()`, etc.) and builders (`NoteBuilder`, `ChordBuilder`, `DrumHitBuilder`).

### Phase 4: Clip Class

New `Clip` class with `pipe()`, `compose()`, `freeze()`, `use()`. Deprecate `SynapticClip`, `SynapticMelody`, `SynapticDrums`.

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
| 5 | `ExecutionContext` and `CompositionBridge` are separate (no inheritance) | Different concerns: stateless I/O vs fully deferred composition. Type system enforces boundary |
| 6 | `CompositionBridge` is fully pure | Zero side effects during composition. Thunks deferred until `.commit(bridge)` |
| 7 | `.commit(bridge)` executes accumulated thunks | Polymorphic: kernel, serialization, recording. Compose once, commit many |
| 8 | Transforms are CompositionBridge decorators | Each concern isolated. Note operations don't know about transforms |
| 9 | `with*` prefix for ALL methods | State modifiers AND event methods: `withVelocity()`, `withNote()`, `withCC()`. Uniform immutable API |
| 10 | Builders implement PipeStep | `apply(bridge)` called during materialization. One interface, one method |
| 11 | Removed `.use()` from scope builders | Redundant — `use()` is a notation function usable inside `.steps()`. Simplifies `ScopeEntry` to `PipeStep[][]` |
| 12 | Instrument markings are standalone functions | `sustain()`, `breath()`, `bend()` — named wrappers around cc/pitchBend |
| 13 | Pipe steps never access ExecutionContext directly | Type system prevents kernel writes during composition |
| 14 | Construction-time execution, not playback | Pipe runs on main thread. Allocations are free. Kernel is sole runtime truth |
| 15 | Clips are reusable, stay alive after materialization | Materialize N times into N different bridges |
| 16 | Namespaced exports for discoverability | `Melody.note()`, `Drums.kick()`, `Fx.humanize()` — IDE autocomplete |
| 17 | Structural sharing via persistent linked list | O(1) thunk append, O(1) fork for `stack()`, O(n) shared tails |
| 18 | Transactional composition | If pipe step throws, nothing is written. Discard bridge = free rollback |
| 19 | Compose once, commit many | Same thunk list committed to kernel, serializer, recorder independently |
| 20 | PipeStep creator functions are called "notations" | Musical term. Dictionary-accurate: notes, dynamics, transforms are all musical notations |
| 21 | RFC-058 lands before RFC-050 | Composition layer is the foundation modulation sits on |
| 22 | Scoped setters via `FieldSetter` | Single generic class for all setter scoping. Closure-parameterized, zero duplication |
| 23 | Key context is separate from scale context | `keyRoot`/`keyMode` for accidentals, `scaleRoot`/`scaleMode` for degree-based notation |
| 24 | Late key resolution in NoteBuilder | `rawPitch` string carried alongside MIDI pitch. Key accidentals applied at `apply()` time via `applyKeySignature` |
| 25 | `isolate()` for full context isolation | Nothing leaks out. Inner steps see parent context but changes don't propagate |
| 26 | RNG consistency: bridges take SeededRandom, builders resolve null fallback | Deterministic composition via KNUTH_MULTIPLIER * tick fallback |
