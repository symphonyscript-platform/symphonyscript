# RFC-058: Immutable Composition Layer

**Status:** Draft
**Depends on:** None (prerequisite for RFC-050)
**Supersedes:** RFC-049 (Synaptic Cursor Architecture)

---

## 1. Abstract

This RFC defines the composition layer architecture for SymphonyScript. Clips are **immutable value types** that describe musical content via a **reducer pipeline**. Execution is **deferred** — no kernel interaction occurs until explicit materialization against an `IBridge` implementation.

The bridge interface is the sole polymorphism point: `KernelBridge` writes to SAB, `RecordingBridge` captures notes, `SerializationBridge` exports JSON, `ClipBridge` carries context. All transforms (transpose, humanize, quantize) are bridge decorators.

A phantom type tracks serializability at compile time: arrow functions in `.when()` taint the clip as `Unserializable`, preventing use with `SerializationBridge`.

---

## 2. Motivation

The current composition layer (SynapticClip) has three problems:

1. **Eager SAB writes.** Every `.note()` call immediately writes to the kernel via `bridge.insertAsync()`. Unused clips (loaded but never played) pollute the node heap.

2. **Mutable state.** Clips accumulate state internally (currentTick, velocity, transpose). This creates ordering dependencies, aliasing bugs, and makes hot-swap during live-coding dangerous.

3. **Bridge as constructor dependency.** Clips require a `SiliconBridge` at construction time, coupling composition to the kernel. Testing, serialization, and composition-time introspection require workarounds.

---

## 3. Architecture Overview

### 3.1 Lifecycle

```
Compose (main thread, allocations permitted)
  ↓
Clip = immutable pipeline of reducer steps
  ↓
materialize(bridge)  ← explicit trigger
  ↓
Bridge writes to target (SAB / JSON / recording / etc.)
  ↓
Runtime (audio thread, zero allocation)
  ↓
Kernel is sole source of truth
```

### 3.2 Reducer Pattern

Each clip method adds a step to a composed function. The `reduce()` helper on the base class handles accumulation:

```typescript
protected reduce(
  step: (prev: Pipe, bridge: IBridge, ctx: number, tick: number) => IBridge
): this {
  const prev = this._pipe;
  this._pipe = (bridge, ctx, tick) => step(prev, bridge, ctx, tick);
  return this;  // returns new immutable instance (clone-on-write)
}
```

A method like `.note()` never manually captures `this._pipe`. It calls `this.reduce()`:

```typescript
note(pitch: string | number, duration?: number): INoteCursor {
  const tick = this.currentTick;
  const dur = duration ?? this.getDefaultDuration();
  const sourceId = this.generateSourceId();

  return this.reduce((prev, bridge, ctx, tick) => {
    const b = prev(bridge, ctx, tick);
    b.insertNote(pitch + unpackTranspose(ctx), unpackVelocity(ctx), dur, tick, false, sourceId);
    return b;
  });
}
```

### 3.3 Immutability

Every mutating method returns a **new instance**. The original is untouched:

```typescript
const base = Clip.melody().note('C4');     // Clip A
const withE = base.note('E4');              // Clip B (A untouched)
const withG = base.note('G4');              // Clip C (A untouched, B untouched)
```

Clips are value types. Sharing, reuse, and composition are safe by construction.

---

## 4. Bridge Interface

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

  /** Insert a MIDI Control Change event. */
  insertCC(controller: number, value: number, tick: number, sourceId: number): number;

  /** Insert a pitch bend event. */
  insertBend(value: number, tick: number, sourceId: number): number;

  /** Set a parameter value (0–1000 range). */
  setParam(paramId: number, value: number): void;

  /** Create a synapse connection. */
  connect(srcId: number, tgtId: number, weight?: number): void;

  /** Remove a synapse connection. */
  disconnect(srcId: number, tgtId: number): void;

  /** Mark a node for reclamation. */
  reclaim(nodePtr: number): void;

  /** Process pending commands. */
  poll(): number;

  /** Get the PPQ (pulses per quarter note) resolution. */
  getPpq(): number;
}
```

### 4.1 Bridge Implementations

| Bridge | Purpose | Serializable input required? |
|:---|:---|:---|
| `KernelBridge` | Writes to SAB via `Atomics` | No |
| `RecordingBridge` | Captures note data for `FrozenClip` and tests | No |
| `SerializationBridge` | Exports operations as JSON/blob/protobuf | **Yes** |
| `ClipBridge` | Decorator — carries packed context, delegates to inner bridge | No |
| `HumanizingBridge` | Decorator — jitters velocity and timing on `insertNote()` | No |
| `TransposingBridge` | Decorator — shifts pitch on `insertNote()` | No |
| `QuantizingBridge` | Decorator — snaps tick to grid on `insertNote()` | No |
| `SwingBridge` | Decorator — applies swing timing on `insertNote()` | No |
| `DynamicsBridge` | Decorator — scales velocity over time on `insertNote()` | No |

### 4.2 Bridge Decorator Stacking

Transforms compose by wrapping:

```
KernelBridge → QuantizingBridge → SwingBridge → HumanizingBridge → TransposingBridge
```

Each layer intercepts `insertNote()`, transforms arguments, delegates to inner bridge. Notes and cursors only call `bridge.insertNote()` — they don't know about any transforms.

---

## 5. Packed Context

A single `Int32` carries discrete settings through the pipeline. Float values (tick) are separate parameters.

### 5.1 Bit Layout

```
Bits 31–24: Transpose offset (signed byte, -128 to +127 semitones)
Bits 23–14: Base velocity (0–1000)
Bits 13–7:  Quantize grid (0–127, in 32nds of a beat)
Bit 6:      HUMANIZE flag
Bit 5:      QUANTIZE flag
Bit 4:      MUTED flag
Bit 3:      STACKING flag
Bit 2:      PRECISE flag (skip humanization)
Bits 1–0:   Reserved
```

### 5.2 Unpack Utilities

```typescript
export const CTX = {
  TRANSPOSE_SHIFT: 24,
  TRANSPOSE_MASK:  0xFF,
  VELOCITY_SHIFT:  14,
  VELOCITY_MASK:   0x3FF,
  QGRID_SHIFT:     7,
  QGRID_MASK:      0x7F,
  HUMANIZE:        0x40,
  QUANTIZE:        0x20,
  MUTED:           0x10,
  STACKING:        0x08,
  PRECISE:         0x04,
} as const;

export const unpackTranspose = (ctx: number): number =>
  ((ctx >>> CTX.TRANSPOSE_SHIFT) & CTX.TRANSPOSE_MASK) - 128;

export const unpackVelocity = (ctx: number): number =>
  (ctx >>> CTX.VELOCITY_SHIFT) & CTX.VELOCITY_MASK;

export const unpackQGrid = (ctx: number): number =>
  (ctx >>> CTX.QGRID_SHIFT) & CTX.QGRID_MASK;

export const hasFlag = (ctx: number, flag: number): boolean =>
  (ctx & flag) !== 0;

export const packTranspose = (ctx: number, semitones: number): number =>
  (ctx & ~(CTX.TRANSPOSE_MASK << CTX.TRANSPOSE_SHIFT))
  | (((semitones + 128) & CTX.TRANSPOSE_MASK) << CTX.TRANSPOSE_SHIFT);

export const packVelocity = (ctx: number, vel: number): number =>
  (ctx & ~(CTX.VELOCITY_MASK << CTX.VELOCITY_SHIFT))
  | ((vel & CTX.VELOCITY_MASK) << CTX.VELOCITY_SHIFT);

export const packQGrid = (ctx: number, grid: number): number =>
  (ctx & ~(CTX.QGRID_MASK << CTX.QGRID_SHIFT))
  | ((grid & CTX.QGRID_MASK) << CTX.QGRID_SHIFT);

export const setFlag = (ctx: number, flag: number): number => ctx | flag;

export const clearFlag = (ctx: number, flag: number): number => ctx & ~flag;
```

---

## 6. Serializability Type System

### 6.1 Phantom Types

```typescript
declare const SERIALIZABLE_BRAND: unique symbol;
declare const UNSERIALIZABLE_BRAND: unique symbol;

type Serializable = { readonly [SERIALIZABLE_BRAND]: true };
type Unserializable = { readonly [UNSERIALIZABLE_BRAND]: true };
```

### 6.2 Propagation

Every interface carries a phantom type parameter `S`:

```typescript
interface IClip<T extends IClip<T, S>, S extends Serializable | Unserializable = Serializable> { ... }
```

- Most methods propagate `S` unchanged.
- `.when(fn: Function)` returns `IClip<T, Unserializable>`.
- `.when(expr: IExpr)` returns `IClip<T, S>` (preserves current serializability).

### 6.3 Enforcement

```typescript
class SerializationBridge implements IBridge {
  static materialize<T>(clip: IClip<T, Serializable>): string { ... }
  //                                    ^^^^^^^^^^^^  compile-time guard
}

// ✅ Compiles
SerializationBridge.materialize(Clip.melody().note('C4').when(Expr.gt(Scene, 500)));

// ❌ Compile error: Unserializable
SerializationBridge.materialize(Clip.melody().note('C4').when(v => v > 500));
```

---

## 7. Interfaces

### 7.1 Pipe Type

```typescript
type Pipe = (bridge: IBridge, ctx: number, tick: number) => IBridge;
```

### 7.2 `IClip<T, S>` — Base Clip Interface

All clip types extend this. `T` is the concrete type for fluent returns. `S` is the serializability phantom.

```typescript
interface IClip<T extends IClip<T, S>, S extends Serializable | Unserializable = Serializable> {

  // === Identity ===

  /** Set clip name for identification. */
  name(n: string): T;

  // === Temporal ===

  /** Advance tick by duration without emitting a note. */
  rest(duration: number): T;

  /** Set tempo in BPM. */
  tempo(bpm: number): T;

  /** Set time signature. */
  timeSignature(numerator: number, denominator: number): T;

  /** Set default note duration for notes that don't specify one. */
  defaultDuration(beats: number): T;

  // === Timing Transforms (applied via bridge decorators) ===

  /** Apply swing timing. Amount 0.0–1.0 (0.5 = no swing). */
  swing(amount: number): T;

  /** Apply named groove template. */
  groove(template: string): T;

  /** Enable humanization (velocity and timing jitter). */
  humanize(velocity: number, timing?: number): T;

  /** Disable humanization for subsequent notes. */
  precise(): T;

  /** Snap notes to grid. Strength 0.0–1.0 (1.0 = full snap). */
  quantize(grid: number, strength?: number): T;

  // === Pitch Transforms (applied via bridge decorators) ===

  /** Transpose all subsequent notes by semitones. */
  transpose(semitones: number): T;

  /** Set absolute octave (4 = middle C octave). */
  octave(n: number): T;

  /** Shift up by n octaves (default 1). */
  octaveUp(n?: number): T;

  /** Shift down by n octaves (default 1). */
  octaveDown(n?: number): T;

  // === Tonal Context ===

  /** Set scale context. E.g., "C major", "A minor". */
  scale(name: string): T;

  /** Set key signature for automatic accidentals. */
  key(root: string, mode: ScaleMode): T;

  /** Set accidental override for the next note. */
  accidental(acc: Accidental): T;

  // === Dynamics ===

  /** Set base velocity for subsequent notes (0–1000). */
  velocity(v: number): T;

  /** Gradual velocity increase over duration. */
  crescendo(duration: number, from?: number, to?: number): T;

  /** Gradual velocity decrease over duration. */
  decrescendo(duration: number, from?: number, to?: number): T;

  // === Composition ===

  /** Insert another clip's content at current tick position. */
  play(clip: IClip<any, any>): T;

  /** Repeat a clip or builder function. */
  loop(count: number, source: IClip<any, any> | ((clip: T) => void)): T;

  /** Execute builder in parallel (same tick, tick does not advance). */
  stack(fn: (clip: T) => void): T;

  /** Execute builder within MPE voice scope (id 1–15). */
  voice(id: number, fn: (clip: T) => void): T;

  /** Repeat the previous note or chord n times. */
  repeat(n: number): T;

  /** Reverse the content of this clip (retrograde). */
  reverse(): T;

  /** Time-stretch content by factor (2.0 = double duration). */
  stretch(factor: number): T;

  // === Probability ===

  /** Set probability for the next note (0.0–1.0). Deterministic via seed. */
  chance(probability: number): T;

  // === Conditional (dual mode) ===

  /** Condition via serializable expression (preserves S). */
  when(expr: IExpr): IClip<T, S>;

  /** Condition via arrow function (taints as Unserializable). */
  when(fn: (value: number) => boolean): IClip<T, Unserializable>;

  // === Topology ===

  /** Create synapse to target clip with optional weight (0–1000). */
  linkTo(target: IClip<any, any>, weight?: number): ILinkCursor<T, S>;

  /** Set loop region boundaries (creates BARRIER node). */
  setLoopRegion(start: number, end: number): T;

  // === Lifecycle ===

  /** Execute pipeline against a bridge (triggers SAB writes / serialization / etc). */
  materialize(bridge: IBridge): void;

  /** Snapshot clip state into a FrozenClip for composition-time reuse. */
  freeze(): IFrozenClip;
}
```

### 7.3 `IMelodyClip<S>` — Pitched Melodic Content

```typescript
interface IMelodyClip<S extends Serializable | Unserializable = Serializable>
  extends IClip<IMelodyClip<S>, S> {

  // === Single Notes ===

  /** Create a note by pitch name or MIDI number. Returns cursor for properties. */
  note(pitch: string | number, duration?: number): INoteCursor<S>;

  // === Scale Degrees ===

  /** Create a note from scale degree. Requires scale() context. */
  degree(deg: number, duration?: number): INoteCursor<S>;

  // === Chords ===

  /** Create chord by symbol (e.g., "Am", "C7", "Dm9"). */
  chord(symbol: string): IChordCursor<S>;

  /** Create chord from scale degrees. Requires scale() context. */
  degreeChord(degrees: number[], duration?: number): IChordCursor<S>;

  /** Create chord from roman numeral. Requires key() context. */
  roman(numeral: string, duration?: number): IChordCursor<S>;

  /** Emit chord progression from roman numerals. */
  progression(numerals: string[], duration?: number): IMelodyClip<S>;

  /** Emit voice-led chord progression (minimizes voice movement). */
  voiceLead(numerals: string[], duration?: number): IMelodyClip<S>;

  // === Patterns ===

  /** Arpeggiate pitches with pattern. */
  arpeggio(
    pitches: (string | number)[],
    rate: number,
    pattern?: ArpPattern,
    octaves?: number
  ): IMelodyClip<S>;

  /** Generate Euclidean rhythm with notes. */
  euclidean(
    hits: number,
    steps: number,
    notes: (string | number)[],
    stepDuration: number,
    rotation?: number
  ): IMelodyClip<S>;

  /** Binary step pattern. 1 = play, 0 = rest. */
  steps(pattern: number[], notes: (string | number)[], stepDuration: number): IMelodyClip<S>;

  /** Polyrhythm: n notes evenly spaced over m beats. */
  polyrhythm(notes: number, overBeats: number, fn: (clip: IMelodyClip<S>) => void): IMelodyClip<S>;

  // === Ornaments ===

  /** Trill between current pitch and target pitch. */
  trill(pitch: string | number, rate: number, duration: number): IMelodyClip<S>;

  /** Grace note before the next main note. */
  grace(pitch: string | number): INoteCursor<S>;

  /** Glissando (pitch slide) from one pitch to another. */
  glissando(from: string | number, to: string | number, duration: number): IMelodyClip<S>;

  /** Rapid repeated note (tremolo picking). */
  tremolo(pitch: string | number, rate: number, duration: number): IMelodyClip<S>;

  // === Tuplets ===

  /** Execute builder in tuplet time (e.g., triplet: count=3, inBeats=2). */
  tuplet(count: number, inBeats: number, fn: (clip: IMelodyClip<S>) => void): IMelodyClip<S>;

  // === MIDI Events ===

  /** Send MIDI CC at current tick. */
  cc(controller: number, value: number): IMelodyClip<S>;

  /** Send pitch bend at current tick. */
  pitchBend(value: number): IMelodyClip<S>;

  /** Send aftertouch at current tick. */
  aftertouch(value: number, note?: string | number): IMelodyClip<S>;
}
```

### 7.4 `IDrumClip<S>` — Percussion Content

```typescript
interface IDrumClip<S extends Serializable | Unserializable = Serializable>
  extends IClip<IDrumClip<S>, S> {

  // === Named Hits (return cursors) ===

  /** Bass drum hit. */
  kick(duration?: number): IDrumHitCursor<S>;

  /** Snare drum hit. */
  snare(duration?: number): IDrumHitCursor<S>;

  /** Closed hi-hat hit. */
  hihat(duration?: number): IDrumHitCursor<S>;

  /** Open hi-hat hit. */
  openHat(duration?: number): IDrumHitCursor<S>;

  /** Hand clap hit. */
  clap(duration?: number): IDrumHitCursor<S>;

  /** Tom hit (n: 1=high, 2=mid, 3=low). */
  tom(n: number, duration?: number): IDrumHitCursor<S>;

  /** Crash cymbal hit. */
  crash(duration?: number): IDrumHitCursor<S>;

  /** Ride cymbal hit. */
  ride(duration?: number): IDrumHitCursor<S>;

  /** Rim shot. */
  rim(duration?: number): IDrumHitCursor<S>;

  /** Cowbell hit. */
  cowbell(duration?: number): IDrumHitCursor<S>;

  /** Shaker hit. */
  shaker(duration?: number): IDrumHitCursor<S>;

  // === Generic ===

  /** Any named percussion sound. */
  hit(name: string, duration?: number): IDrumHitCursor<S>;

  // === Pattern Shorthand ===

  /** Text pattern. 'x' = hit, '.' = rest, '-' = sustain. E.g., "x..x..x.". */
  pattern(notation: string, stepDuration?: number): IDrumClip<S>;

  /** Euclidean rhythm pattern. */
  euclidean(hits: number, steps: number, stepDuration?: number, rotation?: number): IDrumClip<S>;

  /** Binary step pattern. */
  steps(pattern: number[], stepDuration: number): IDrumClip<S>;

  // === Ornaments ===

  /** Flam: two rapid hits (grace note + main). */
  flam(hit?: string): IDrumHitCursor<S>;

  /** Drag: three rapid hits. */
  drag(hit?: string): IDrumHitCursor<S>;

  /** Buzz roll at given rate for duration. */
  roll(duration: number, rate?: number): IDrumClip<S>;

  // === Polyrhythm ===

  /** Polyrhythm: n hits evenly spaced over m beats. */
  polyrhythm(hits: number, overBeats: number): IDrumClip<S>;
}
```

### 7.5 `INoteCursor<S>` — Note Property Cursor (Immutable)

Each method returns a new cursor. `commit()` returns to the parent clip.

```typescript
interface INoteCursor<S extends Serializable | Unserializable = Serializable> {

  // === Properties ===

  /** Set velocity (0–1000). */
  velocity(v: number): INoteCursor<S>;

  /** Set duration in beats. */
  duration(d: number): INoteCursor<S>;

  /** Override pitch after creation. */
  pitch(p: string | number): INoteCursor<S>;

  // === Articulation ===

  /** Legato: connect to next note (full duration, no gap). */
  legato(): INoteCursor<S>;

  /** Staccato: shorten duration to factor × original (default 0.5). */
  staccato(factor?: number): INoteCursor<S>;

  /** Accent: velocity bump (default +200). */
  accent(amount?: number): INoteCursor<S>;

  /** Ghost note: velocity duck (default -300). */
  ghost(amount?: number): INoteCursor<S>;

  /** Tenuto: full duration with slight accent. */
  tenuto(): INoteCursor<S>;

  /** Marcato: strong accent (default +400). */
  marcato(): INoteCursor<S>;

  /** Skip humanization for this note. */
  precise(): INoteCursor<S>;

  // === Expression ===

  /** Pitch bend during this note's duration. */
  bend(amount: number): INoteCursor<S>;

  /** Portamento slide to target pitch. */
  slide(toPitch: string | number): INoteCursor<S>;

  // === Repetition ===

  /** Repeat this note n times at current duration. */
  repeat(n: number): INoteCursor<S>;

  // === Modulation (RFC-050) ===

  /** Attach a modulator to this note's properties. */
  mod(param: IParam): IModulatorCursor<S>;

  // === Finalize ===

  /** Commit note and return to parent clip. */
  commit(): IMelodyClip<S>;
}
```

### 7.6 `IChordCursor<S>` — Chord Property Cursor (Immutable)

```typescript
interface IChordCursor<S extends Serializable | Unserializable = Serializable> {

  // === Properties ===

  /** Set velocity (0–1000). */
  velocity(v: number): IChordCursor<S>;

  /** Set duration in beats. */
  duration(d: number): IChordCursor<S>;

  // === Voicing ===

  /** Set inversion (0 = root position, 1 = first, 2 = second, 3 = third). */
  inversion(n: number): IChordCursor<S>;

  /** Drop-2 voicing: second-highest note dropped an octave. */
  drop2(): IChordCursor<S>;

  /** Drop-3 voicing: third-highest note dropped an octave. */
  drop3(): IChordCursor<S>;

  /** Open voicing: spread notes across octaves. */
  open(): IChordCursor<S>;

  /** Close voicing: tight, within one octave. */
  close(): IChordCursor<S>;

  // === Strumming ===

  /** Strum chord with delay between notes. Direction: 'up' or 'down'. */
  strum(rate: number, direction?: 'up' | 'down'): IChordCursor<S>;

  /** Delay between chord voices in beats. */
  spread(amount: number): IChordCursor<S>;

  // === Articulation ===

  /** Accent: velocity bump. */
  accent(amount?: number): IChordCursor<S>;

  /** Ghost: velocity duck. */
  ghost(amount?: number): IChordCursor<S>;

  /** Staccato: shorten chord duration. */
  staccato(factor?: number): IChordCursor<S>;

  /** Legato: connect to next chord. */
  legato(): IChordCursor<S>;

  // === Repetition ===

  /** Repeat this chord n times. */
  repeat(n: number): IChordCursor<S>;

  // === Modulation (RFC-050) ===

  /** Attach modulator. */
  mod(param: IParam): IModulatorCursor<S>;

  // === Finalize ===

  /** Commit chord and return to parent clip. */
  commit(): IMelodyClip<S>;
}
```

### 7.7 `IDrumHitCursor<S>` — Drum Hit Property Cursor (Immutable)

```typescript
interface IDrumHitCursor<S extends Serializable | Unserializable = Serializable> {

  /** Set velocity (0–1000). */
  velocity(v: number): IDrumHitCursor<S>;

  /** Set duration in beats. */
  duration(d: number): IDrumHitCursor<S>;

  /** Ghost note: velocity duck. */
  ghost(amount?: number): IDrumHitCursor<S>;

  /** Accent: velocity bump. */
  accent(amount?: number): IDrumHitCursor<S>;

  /** Flam: add grace note before this hit. */
  flam(): IDrumHitCursor<S>;

  /** Drag: add two grace notes before this hit. */
  drag(): IDrumHitCursor<S>;

  /** Skip humanization for this hit. */
  precise(): IDrumHitCursor<S>;

  /** Repeat this hit n times. */
  repeat(n: number): IDrumHitCursor<S>;

  // === Modulation (RFC-050) ===

  /** Attach modulator. */
  mod(param: IParam): IModulatorCursor<S>;

  // === Finalize ===

  /** Commit hit and return to parent drum clip. */
  commit(): IDrumClip<S>;
}
```

### 7.8 `ILinkCursor<T, S>` — Synapse Configuration Cursor (Immutable)

Returned by `clip.linkTo(target)`. Configures synapse properties before finalizing.

```typescript
interface ILinkCursor<T extends IClip<T, S>, S extends Serializable | Unserializable = Serializable> {

  /** Set synapse weight (0–1000). */
  weight(w: number): ILinkCursor<T, S>;

  /** Attach modulator to synapse weight (RFC-050). */
  mod(param: IParam): IModulatorCursor<S>;

  /** Condition (serializable expression). */
  when(expr: IExpr): ILinkCursor<T, S>;

  /** Condition (arrow — taints as Unserializable). */
  when(fn: (value: number) => boolean): ILinkCursor<T, Unserializable>;

  /** Finalize synapse and return to parent clip. */
  commit(): T;
}
```

### 7.9 `IFrozenClip` — Design-Time Snapshot

```typescript
interface IFrozenClip {
  /** Iterate captured notes. */
  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void
  ): void;

  /** Number of captured notes. */
  readonly noteCount: number;

  /** Total duration in beats. */
  readonly duration: number;
}
```

### 7.10 Factory Methods

```typescript
class Clip {
  /** Create an empty melody clip. */
  static melody(): IMelodyClip<Serializable>;

  /** Create an empty drum clip. */
  static drums(): IDrumClip<Serializable>;
}
```

---

## 8. Transforms as Bridge Decorators

Each transform concern is a standalone class wrapping `IBridge`. Applied when the corresponding escape method is called in the reducer.

### 8.1 `TransposingBridge`

```typescript
class TransposingBridge implements IBridge {
  constructor(private inner: IBridge, private semitones: number) {}

  insertNote(pitch, velocity, duration, tick, muted, sourceId, exitId?, expressionId?) {
    return this.inner.insertNote(
      pitch + this.semitones, velocity, duration, tick, muted,
      sourceId, exitId, expressionId
    );
  }
  // All other methods delegate to this.inner unchanged.
}
```

### 8.2 `HumanizingBridge`

```typescript
class HumanizingBridge implements IBridge {
  constructor(
    private inner: IBridge,
    private velAmount: number,
    private timingAmount: number,
    private rng: SeededRandom
  ) {}

  insertNote(pitch, velocity, duration, tick, muted, sourceId, exitId?, expressionId?) {
    const velJitter = (this.rng.next() - 0.5) * 2 * this.velAmount;
    const tickJitter = (this.rng.next() - 0.5) * 2 * this.timingAmount;
    return this.inner.insertNote(
      pitch, velocity + velJitter, duration, tick + tickJitter, muted,
      sourceId, exitId, expressionId
    );
  }
}
```

### 8.3 `QuantizingBridge`

```typescript
class QuantizingBridge implements IBridge {
  constructor(private inner: IBridge, private grid: number, private strength: number) {}

  insertNote(pitch, velocity, duration, tick, muted, sourceId, exitId?, expressionId?) {
    const snapped = Math.round(tick / this.grid) * this.grid;
    const quantized = tick + (snapped - tick) * this.strength;
    return this.inner.insertNote(
      pitch, velocity, duration, quantized, muted, sourceId, exitId, expressionId
    );
  }
}
```

### 8.4 `SwingBridge`

```typescript
class SwingBridge implements IBridge {
  constructor(private inner: IBridge, private amount: number) {}

  insertNote(pitch, velocity, duration, tick, muted, sourceId, exitId?, expressionId?) {
    const beatPos = tick % 1.0;
    const isOffbeat = beatPos >= 0.5 - 0.01;
    const swung = isOffbeat ? tick + (this.amount - 0.5) * 0.5 : tick;
    return this.inner.insertNote(
      pitch, velocity, duration, swung, muted, sourceId, exitId, expressionId
    );
  }
}
```

### 8.5 `DynamicsBridge`

```typescript
class DynamicsBridge implements IBridge {
  constructor(
    private inner: IBridge,
    private startTick: number,
    private duration: number,
    private fromVel: number,
    private toVel: number
  ) {}

  insertNote(pitch, velocity, duration, tick, muted, sourceId, exitId?, expressionId?) {
    const progress = Math.min(1, Math.max(0, (tick - this.startTick) / this.duration));
    const scaled = this.fromVel + (this.toVel - this.fromVel) * progress;
    return this.inner.insertNote(
      pitch, scaled, duration, tick, muted, sourceId, exitId, expressionId
    );
  }
}
```

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
// Old clip = value. Drop the reference.
// New clip = value. Materialize it.
// Atomic. No diffing, no partial updates, no dirty state.
const newClip = Clip.melody().note('D4').note('F#4').note('A4');
session.replace(oldClip, newClip);  // reclaim + materialize + resynapse
```

### 9.3 Tier 3: Direct Note-On (< 0.1%)

Real-time keyboard input bypasses composition entirely:

```typescript
bridge.fireNoteOn(channelId, pitch, velocity);
bridge.fireNoteOff(channelId, pitch);
```

Direct to DSP via `CMD.DIRECT_NOTE_ON`. No SAB node. No clip.

---

## 10. Serialization

### 10.1 Serialize

```typescript
const bridge = new SerializationBridge();
clip.materialize(bridge);
const json = bridge.toJSON();
// → [{"type":"note","pitch":60,"vel":800,"dur":0.25,"tick":0}, ...]
```

### 10.2 Reconstruct

```typescript
const ops = JSON.parse(json);
for (const op of ops) {
  switch (op.type) {
    case 'note': bridge.insertNote(op.pitch, op.vel, op.dur, op.tick, ...); break;
    case 'cc':   bridge.insertCC(op.controller, op.value, op.tick, ...); break;
    case 'bend': bridge.insertBend(op.value, op.tick, ...); break;
  }
}
```

### 10.3 Compile-Time Safety

Arrow functions in `.when()` taint the clip as `Unserializable`:

```typescript
// ✅ Serializable
const a = Clip.melody().note('C4').when(Expr.gt(Scene, 500));

// ❌ Compile error on serialization
const b = Clip.melody().note('C4').when(v => v > 500);
SerializationBridge.materialize(b);  // Type error: Unserializable
```

---

## 11. Migration Plan

### 11.1 Phase 1: Interfaces + Types

Define all interfaces (`IClip`, `IMelodyClip`, `IDrumClip`, cursors) and phantom types. No implementation changes.

### 11.2 Phase 2: Bridge Interface + Decorators

Extract `IBridge` from current `SiliconBridge`. Implement decorator bridges (`TransposingBridge`, etc.). Current clips continue using direct bridge calls.

### 11.3 Phase 3: Reducer Infrastructure

Add `reduce()` to base clip class. Implement `Pipe` type. Clips accumulate pipelines alongside current eager writes (dual mode for incremental migration).

### 11.4 Phase 4: Immutable Clip Classes

New `MelodyClip` and `DrumClip` implementations using clone-on-write + reducer. All methods return new instances. Old `SynapticClip`, `SynapticMelody`, `SynapticDrums` deprecated.

### 11.5 Phase 5: Immutable Cursors

New `NoteCursor`, `ChordCursor`, `DrumHitCursor` implementations. Clone-on-write. Old cursor classes deprecated.

### 11.6 Phase 6: Remove Legacy

Delete `SynapticClip`, `SynapticMelody`, `SynapticDrums`, `SynapticCursor`, old cursor classes. All composition goes through immutable interfaces.

---

## Appendix A: Decision Log

| # | Decision | Rationale |
|:---|:---|:---|
| 1 | Deferred execution via reducer | No eager SAB writes. Materialization is explicit |
| 2 | `reduce((prev, bridge, ctx, tick) => Bridge)` primitive | Methods never manually capture pipe. Framework handles accumulation |
| 3 | Clips are immutable value types | Thread-safe, composable, reusable. Clone-on-write |
| 4 | Cursors are immutable | Same pattern as clips. Every method returns new cursor |
| 5 | Bridge is the polymorphism point | One interface, five+ implementations. Description vs execution |
| 6 | Transforms are bridge decorators | Each concern isolated. Replaces monolithic `flushNote()` |
| 7 | ClipBridge carries packed context | Bitwise Int32 for discrete settings + float tick |
| 8 | Clips stay alive after materialization | Reusable templates. Materialize N times |
| 9 | Materialization is explicit | `session.add()` or `clip.materialize(bridge)`. Zero implicit kernel interaction |
| 10 | Phantom type for serializability | `.when(arrow)` → `Unserializable`. Compile-time enforcement |
| 11 | Both arrows and Expr coexist | Maximum flexibility with clear consequences |
| 12 | Structure is composed, content is modulated | Clips define structure. Parameters drive content at runtime |
| 13 | Code is the canonical composition format | `.ts` files are the source of truth. Serialization is for snapshots/export |
| 14 | Fresh API surface from scratch | All interfaces designed independently from legacy SynapticClip |
| 15 | RFC-058 lands before RFC-050 | Composition layer is the foundation modulation sits on |
