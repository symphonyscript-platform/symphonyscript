# RFC-060: Continuous Pitch Architecture

**Status:** Draft
**Depends on:** RFC-058 (Immutable Composition Layer)
**Supersedes:** RFC-047 (24-EDO Native Scale Definitions) — partially; data structures change, algorithms adapt

---

## 1. Abstract

This RFC replaces SymphonyScript's fixed-grid pitch system (24-EDO integers, MIDI note numbers) with a **continuous pitch model** based on cents. Pitch is no longer quantized to 12 or 24 equal divisions of the octave. Instead, every pitch is a floating-point cent value from a fixed reference (C0 = 0), capable of representing any tuning system — equal temperament, just intonation, Pythagorean, maqam, gamelan, Bohlen-Pierce, or user-defined.

The change spans three packages:

- **Theory:** Interval arrays replace bitmasks. Temperament definitions map scale/chord names to cent intervals. The `PitchClass` enum is removed; pitch class becomes a string parsed by notation modules.
- **Composer:** All internal pitch values become absolute cents (Float64 in JS). API functions ("cues") accept note name strings resolved through the current temperament, or raw cent numbers (tuning-independent). New cues: `offset()`, `tuning()`, `temperament()`.
- **Kernel:** The synapse node gains a dedicated Float32 pitch field replacing the 8-bit packed integer. No MIDI translation — the kernel speaks cents natively.

---

## 2. Motivation

### 2.1 Why Not 12-EDO

MIDI's 12-EDO pitch model (128 discrete notes) was designed in 1983 for Western keyboard instruments. It cannot represent:

- **Quarter tones** — fundamental to Arabic maqam, Turkish makam, contemporary classical
- **Just intonation** — pure harmonic ratios used in choral music, barbershop, Indian classical
- **Shruti system** — 22 divisions per octave in Indian classical music
- **Gamelan tuning** — non-octave scales (slendro, pelog)
- **Spectral music** — pitches derived from the harmonic series
- **Micro-tuning** — any pitch between the 12 semitones

Sticking to 12-EDO repeats a historical limitation. SymphonyScript should not be constrained by a 40-year-old protocol's design decisions.

### 2.2 Why Not 24-EDO

The existing theory package uses 24-EDO (quarter-tone resolution). This covers Arabic/Turkish music but still imposes a fixed grid:

- Just intonation major third = 386.31 cents. 24-EDO nearest = 400 cents (14 cents off — audible).
- Pythagorean comma, syntonic comma, septimal intervals — none land on the 24-EDO grid.
- Custom tuning systems (gamelan, Bohlen-Pierce, user-defined) are impossible to represent on any fixed grid.

24-EDO is a better grid than 12-EDO, but it is still a grid.

### 2.3 Why Continuous Pitch

Continuous pitch (floating-point cents) imposes **no grid**. Every tuning system is a first-class citizen:

```typescript
temperament('equal')         // A major third = 400.00 cents
temperament('just')          // A major third = 386.31 cents
temperament('pythagorean')   // A major third = 407.82 cents
temperament([0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 996, 1088])
                              // Fully custom cent table
```

This aligns with the precedent already set by the velocity system: the composer uses 0–1000 (its own domain) instead of MIDI's 0–127. Pitch should follow the same principle — the composer's internal domain, not MIDI's.

---

## 3. Design

### 3.1 Internal Pitch Unit: Cents

All pitch values within the composer are **floating-point cents from C0 = 0**.

| Note | Equal Temperament (cents) |
|------|---------------------------|
| C0   | 0.0                       |
| A0   | 900.0                     |
| C4   | 4800.0                    |
| A4   | 5700.0                    |
| C5   | 6000.0                    |

One octave = 1200 cents. One equal-tempered semitone = 100 cents.

**Why cents over Hz:** Cents keep interval math as addition (`transpose up a fifth = +700`). Hz requires multiplication (`× 1.4983`), which accumulates floating-point drift. Cents are relative and composable; Hz are absolute and multiplicative. The `cents → Hz` conversion happens once at the synthesis edge:

```
freq = referenceHz × 2^(cents / 1200)
```

### 3.2 Pitch Input Modes

The composer accepts pitch through three mechanisms:

| Input | Meaning | Tuning-dependent? |
|-------|---------|-------------------|
| `note('C4')` | Named pitch — resolved through current temperament | Yes |
| `note(4800)` | Absolute cents from C0 | No |
| `offset(100)` | Cents relative to current tuning reference (A4 by default) | Yes (reference) |
| `degree(5)` | Scale degree — resolved through current scale + temperament | Yes |

- **Strings are temperament-aware.** `note('E4')` = 5200 cents in equal temperament, 5186.31 cents in just intonation.
- **Numbers are absolute.** `note(5200)` = exactly 5200 cents from C0, regardless of temperament.
- **`offset()` is reference-relative.** `offset(0)` = the tuning reference pitch (A4 at whatever Hz).
- **`degree()` is scale-relative.** Resolved through the current scale's interval array.

### 3.3 Tuning and Temperament

Two new cues (setter-style, like `tempo()` and `velocity()`):

**`tuning(hz)`** — sets the reference frequency. Default: A4 = 440 Hz. Stored as Hz, passed through to the synthesis edge. The composer never uses this value internally — all composer math is in cents.

```typescript
tuning(440)    // Standard (default)
tuning(432)    // Alternative
tuning(415)    // Baroque pitch
```

**`temperament(input)`** — defines how note names map to cent intervals. Accepts a string preset or a custom cent array.

```typescript
temperament('equal')           // 12-TET (default)
temperament('just')            // Just intonation (5-limit)
temperament('pythagorean')     // Pythagorean tuning
temperament('meantone')        // Quarter-comma meantone
temperament([0, 112, 204, ...]) // Custom 12-tone cent table
```

A temperament is an array of 12 (or more) cent intervals from the root, defining the chromatic pitch classes. When the user writes `note('E4')`, the composer:

1. Parses `'E'` → pitch class index 4 (via western notation parser)
2. Looks up `temperament[4]` → e.g. 386.31 cents (just) or 400.0 cents (equal)
3. Adds octave: `4 × 1200 + 386.31 = 5186.31` absolute cents
4. Stores 5186.31 in the bridge

### 3.4 Scales and Degrees

Scales become **arrays of cent intervals from the root**, not bitmasks.

The temperament determines what intervals a named scale produces:

```typescript
// Equal temperament major scale:
[0, 200, 400, 500, 700, 900, 1100]

// Just intonation major scale:
[0, 204, 386, 498, 702, 884, 1088]
```

`degree(n)` looks up `scaleIntervals[n - 1]` and adds it to the root's absolute cent value.

Users can also provide explicit interval arrays:

```typescript
scale('D', [0, 150, 350, 500, 700, 850, 1050])   // Custom scale
```

### 3.5 Chords

Chords are **arrays of cent intervals from the root**, replacing `HarmonyMask` bitmasks.

```typescript
// Equal temperament major triad: [0, 400, 700]
// Just intonation major triad:   [0, 386, 702]
```

The `chord('Cmaj7')` parser (western notation module) maps the string to an interval array using the current temperament. The `HarmonyBuilder` stores `intervals: number[]` instead of `mask: HarmonyMask`.

At apply-time, each interval is added to the root's absolute cent value, and `withNote()` is called once per chord tone. The bridge remains simple — it only knows about single pitches.

Ratio input is also supported and normalized to cents:

```typescript
chord(ratios(1, 5/4, 3/2))    // → [0, 386.31, 701.96] cents
```

### 3.6 Interval Constants

Exported constant object for ergonomic use:

```typescript
export const Interval = {
  Unison: 0,
  Semitone: 100,
  WholeTone: 200,
  MinorThird: 300,
  MajorThird: 400,
  PerfectFourth: 500,
  Tritone: 600,
  PerfectFifth: 700,
  MinorSixth: 800,
  MajorSixth: 900,
  MinorSeventh: 1000,
  MajorSeventh: 1100,
  Octave: 1200,
} as const
```

> Note: These are equal-tempered values. Just-intonation equivalents are different (e.g. just major third = 386.31, not 400).

### 3.7 Transpose

`transpose()` becomes cent-based:

```typescript
transpose(700)                  // Up a fifth (700 cents)
transpose(-100)                 // Down a semitone
transpose(Interval.Octave)      // Up an octave
transpose(Interval.MajorThird)  // Up a major third (equal tempered)
```

### 3.8 `offset()` Cue

New cue — subclass of `PitchStepBuilder`, similar to `note()` and `degree()`:

```typescript
offset(100)    // 100 cents above tuning reference (A4 by default)
offset(0)      // The tuning reference itself
offset(-50)    // 50 cents below reference
```

Resolves to absolute cents at apply-time: `referenceAbsoluteCents + offsetCents`.

### 3.9 Frozen Clip Format

Same shape, pitch becomes cents:

```typescript
// Before (MIDI):
{ pitch: 60,     duration: 480, velocity: 700 }

// After (cents):
{ pitch: 4800.0, duration: 480, velocity: 700 }
```

### 3.10 Bridge Changes

- `withNote(pitch, duration, velocity)` — `pitch` becomes absolute cents (float) instead of MIDI integer.
- `scaleRoot` becomes a cent value (float) instead of `PitchClass` enum.
- `keyRoot` becomes a cent value (float) instead of `PitchClass` enum.
- `scaleIntervals` (new) — the current scale's interval array (`number[]`).
- `temperament` (new) — the current temperament's chromatic interval array.
- `tuningHz` (new) — reference frequency in Hz (passthrough to synthesis).

### 3.11 `rawPitch` Preservation

When the user writes `note('C4')`, the builder stores:

- `pitch: 4800.0` — resolved cents (for the current temperament)
- `rawPitch: 'C4'` — original string (for temperament-aware re-resolution at apply-time)

This ensures that if the temperament changes between builder creation and apply-time, the pitch is re-resolved correctly.

---

## 4. Theory Package Changes

### 4.1 What Dies

| Component | Reason |
|-----------|--------|
| `HarmonyMask` type | Bitmasks can't represent continuous intervals |
| `Interval24EDO` type | 24-EDO grid is eliminated |
| `pack()` / `unpack()` | Bitmask operations |
| `degreeToMask()` | Bitmask conversion |
| `PitchClass` enum | Replaced by string types + cent values |
| `NOTE_TO_SEMITONE` map | Replaced by temperament-aware resolution |

### 4.2 What Survives (Adapted)

| Component | Adaptation |
|-----------|-----------|
| Scale definitions | Become cent-interval arrays instead of bitmask intervals |
| Degree resolution algorithms | Index into interval arrays instead of bitmask lookup |
| Voice leading logic | Works on cent values instead of MIDI/24-EDO |
| `romanToChord()` | Returns interval array instead of bitmask |

### 4.3 What's New

| Component | Purpose |
|-----------|---------|
| Temperament definitions | Named presets mapping pitch classes to cent intervals |
| `Interval` constants | Named cent values for equal-tempered intervals |
| Ratio-to-cents conversion | `ratio(5/4)` → `386.31` cents |

### 4.4 Migration Strategy

1. Build new model under `theory/src/new/` — interval arrays, temperament definitions, cent-based resolution.
2. Port/adapt algorithms from existing files — keep what works, rewrite what needs rewriting.
3. Test new code against old code for cross-validation.
4. Once validated: remove old files, flatten `new/` to `src/`.

---

## 5. Kernel Changes

### 5.1 Pitch Field

The synapse node's packed `PACKED_A` field currently allocates 8 bits for pitch (`pitch & 0xFF`).

**Change:** Add a dedicated **Float32** field for pitch. Do not pack it into `PACKED_A`.

- Adds 4 bytes per node (negligible: 10,000 nodes = 40KB).
- Float32 gives ~7 significant digits — precision of ~0.01 cents, which is ~500× below the human perception threshold (~5 cents).
- Composer math uses Float64 (native JS numbers). Precision loss at the Float32 boundary (~0.01 cents) is inaudible.
- The freed 8 bits in `PACKED_A` can be repurposed for future use.

### 5.2 No MIDI Translation

The kernel speaks cents natively. There is no internal MIDI conversion layer. If MIDI output is ever needed, it is an **edge adapter** — a separate export module, not a core concern.

---

## 6. Composer Changes

### 6.1 Terminology

API functions are renamed from "notations" to **"cues"**. This avoids collision with notation parser modules (e.g. `cues/western/`) and better describes their role: a cue tells the engine what to emit next.

Folder rename: `notations/` → `cues/`

### 6.2 String Notation Parsers

Western notation parsers (`chord('Cmaj7')`, `note('C4')`, `key('D', 'minor')`) live in `composer/src/cues/western/` — a dedicated folder for easy future extraction into a separate `@symphonyscript/notation-western` package.

The `Pitch` string type expands to 24-EDO names for autocompletion:

```typescript
export type Pitch =
  | 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  | 'C#' | 'D#' | 'F#' | 'G#' | 'A#'
  | 'Db' | 'Eb' | 'Gb' | 'Ab' | 'Bb'
  | 'Cq#' | 'Dq#' | 'Eq#' | 'Fq#' | 'Gq#' | 'Aq#' | 'Bq#'
  | 'Dqb' | 'Eqb' | 'Gqb' | 'Aqb' | 'Bqb'
```

Resolution: pitch name → pitch class index → temperament lookup → absolute cents.

### 6.3 New Cues

| Cue | Type | Description |
|-----|------|-------------|
| `tuning(hz)` | Setter | Reference frequency (default 440 Hz) |
| `temperament(input)` | Setter | Chromatic interval mapping (default `'equal'`) |
| `offset(cents)` | PitchStepBuilder | Pitch relative to tuning reference |

### 6.4 Updated Cues

| Cue | Change |
|-----|--------|
| `note(string \| number)` | Number = absolute cents (was MIDI). String = temperament-aware. |
| `degree(n)` | Resolves through cent-based interval array (was 24-EDO bitmask) |
| `chord(symbol)` | Parses to interval array via temperament (was bitmask) |
| `transpose(cents)` | Cent-based (was semitones) |
| `scale(root, mode)` | Root = string or cents. Mode = string → interval array via temperament. |
| `key(root, mode)` | Same as `scale()` |

---

## 7. Summary of Domain Units

| Domain | Pitch | Velocity | Duration | Tuning Ref |
|--------|-------|----------|----------|------------|
| Composer | Cents (Float64) | 0–1000 | Ticks (PPQ 480) | Hz (passthrough) |
| Kernel | Cents (Float32) | 0–1000 | Ticks | Hz (passthrough) |
| Synthesis | Hz | Amplitude | Seconds | — |

---

## 8. Migration Plan

| Phase | Scope | Description |
|-------|-------|-------------|
| 1 | Theory | Build new interval/temperament model under `theory/src/new/`. Port adapted algorithms. Cross-validate against existing 24-EDO code. Flatten when stable. |
| 2 | Composer | Migrate internal pitch from MIDI → cents. Update cues, builders, bridges. Rename `notations/` → `cues/`. Move parsers to `cues/western/`. |
| 3 | Kernel | Add Float32 pitch field to synapse node. Update `patchPitch()`. Repurpose freed bits in `PACKED_A`. |
| 4 | Cleanup | Remove legacy code. Update all tests. Final validation. |

---

## 9. Example: Before and After

### Before (Current — MIDI / 24-EDO)

```typescript
import { ScaleMode } from '@symphonyscript/theory'

Clip.pipe(
  scale('D', ScaleMode.MINOR).default(),
  velocity(700).default(),
  duration('4n').default(),
  note('D4'), note('F4'), note('A4'),
  chord('Dm', 960),
  degree(5).velocity(900),
)
```

### After (Continuous Pitch — Cents)

```typescript
Clip.pipe(
  temperament('just').default(),
  tuning(440).default(),
  scale('D', 'minor').default(),
  velocity(700).default(),
  duration('4n').default(),
  note('D4'), note('F4'), note('A4'),
  chord('Dm', 960),
  degree(5).velocity(900),
)
```

The user-facing API is nearly identical. The difference is internal: `note('D4')` resolves to just-intoned cent values instead of MIDI integers. The temperament context determines the exact pitch, not a fixed grid.
