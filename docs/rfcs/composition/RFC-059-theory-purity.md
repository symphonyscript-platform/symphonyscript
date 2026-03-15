# RFC-059: Theory Package Purity

**Status:** Draft
**Author:** Tornika Tsomaia
**Depends on:** RFC-047, RFC-058

---

## 1. Abstract

`@symphonyscript/theory` currently mixes two concerns: **music theory** (math, enums, interval arithmetic) and **notation parsing** (string-to-number conversion, note name handling). This RFC separates them. Theory becomes pure math. All string parsing moves to `@symphonyscript/composer`.

---

## 2. Problem

Theory exports ~20 functions that accept or return strings: `noteToMidi('C4')`, `parseNote('F#3')`, `midiToNote(60)`, `parseRomanNumeral('bVII')`, `transposeNote('C4', 7)`, etc. These couple theory to Western letter notation — an arbitrary representation choice, not a mathematical fact.

This violates the layering established by RFC-058:

```
Notation functions (strings)  →  Bridge (numbers/enums)  →  ExecutionContext (SAB writes)
         ↑ parsing lives here          ↑ theory math here
```

Currently, theory straddles both layers.

---

## 3. Principle

> **Theory computes. Notation parses.**

- Theory answers: "What MIDI number is pitch class 0 in octave 4?" → `(4 + 1) * 12 + 0 = 60` (arithmetic)
- Notation answers: "What pitch class does 'C' map to?" → `0` (lookup table)

---

## 4. What Stays in Theory

### 4.1 Enums

- `PitchClass` (numeric: C=0, Cs=1, D=2, ...)
- `ScaleMode`
- `Interval24EDO`
- `ChordQuality` (if exists)

### 4.2 Pure Math Functions

| Function | Signature | Why it stays |
|:---|:---|:---|
| `midiToPitchClass24` | `(midi: number) → Interval24EDO` | Number → number |
| `pitchClass24ToMidi` | `(interval: Interval24EDO) → number` | Number → number |
| `midiVelocityToNormalized` | `(midi: number) → number` | Number → number |
| `normalizedToMidiVelocity` | `(normalized: number) → number` | Number → number |
| `getScaleIntervals` | `(mode: ScaleMode) → number[]` | Enum → numbers |
| `getChordIntervals` | `(quality: ChordQuality) → number[]` | Enum → numbers |
| `transposeInterval` | `(interval, semitones) → number` | Number → number |
| `isEnharmonic` | `(a: number, b: number) → boolean` | Number → boolean |
| Scale/chord mask operations | Bitwise math | Pure arithmetic |
| Voice leading algorithms | Interval optimization | Pure math |

### 4.3 Constants

- `MIDI_CC` — standard MIDI CC numbers
- `GM_PROGRAM` — General MIDI program numbers
- `GM_DRUM` — General MIDI drum map
- `INTERVAL` — named interval constants
- `SCALE_PATTERNS` — interval patterns per mode

### 4.4 Branded Types

- `MidiChannel`, `MidiValue`, `MidiControlID` — branded number types
- Factory functions (`midiChannel()`, `midiValue()`, `midiControl()`) — number → branded number

---

## 5. What Moves to Composer

### 5.1 From `pitch/midi.ts`

| Function | Reason |
|:---|:---|
| `parseNote(note: string)` | String parsing |
| `noteToMidi(note: string)` | String → number |
| `midiToNote(midi: number)` | Number → string |
| `transposeNote(note: string, semitones)` | String in, string out |
| `noteToPitchClass24(note: string)` | String → number |
| `noteTo24EDO(note: string)` | String → number |
| `NOTE_NAMES` constant | String representation |
| `FLAT_TO_SHARP` mapping | String representation |
| `NOTE_TO_SEMITONE` mapping | String → number lookup |

### 5.2 From `pitch/notes.ts`

| Function | Reason |
|:---|:---|
| `isNoteName(value: string)` | String validation |
| `noteName(value: string)` | String validation + branding |
| `unsafeNoteName(value: string)` | String branding |
| `parseNoteName(note: string)` | String parsing |
| `createNoteName(pitch, octave)` | String creation |
| `isPitchClass(value: string)` | String validation |
| `Notes` factory object | String creation |
| `Pitch` type | String type |
| `NoteName`, `BrandedNoteName`, `LiteralNoteName` types | String types |
| `PITCH_CLASSES` constant | String array |

### 5.3 From `pitch/pitch.ts`

| Function | Reason |
|:---|:---|
| `getIntervalName(interval)` | Number → string |
| `parseIntervalName(name: string)` | String → number |
| `getPitchClassName(interval)` | Number → string |

### 5.4 From `harmony/progressions.ts`

| Function | Reason |
|:---|:---|
| `parseRomanNumeral(numeral: string)` | String parsing |
| `romanToMask(numeral: string, key)` | String → bitmask |
| `romanToChord(numeral: string, key)` | String → string |
| `tritoneSubstitute(root: string)` | String → string |
| `applyTritoneSubstitutions(chords: string[])` | String array transform |

### 5.5 From `harmony/types.ts`

| Function | Reason |
|:---|:---|
| `isAccidental(value: string)` | String validation |
| `isVoiceLeadingStyle(value: string)` | String validation |

### 5.6 `InstrumentId` (from `pitch/midi.ts`)

| Item | Reason |
|:---|:---|
| `InstrumentId` branded type | String type |
| `instrumentId(id: string)` | String branding |
| `isInstrumentId(value)` | String validation |
| `unsafeInstrumentId(id: string)` | String branding |

---

## 6. Destination

All extracted functions move to `packages/composer/src/notation/`:

```
packages/composer/src/notation/
  pitch-parser.ts      ← parseNote, noteToMidi, midiToNote, etc.
  note-names.ts        ← NoteName types, Notes factory, validation
  interval-names.ts    ← getIntervalName, parseIntervalName
  roman-numerals.ts    ← parseRomanNumeral, romanToMask, romanToChord
  index.ts             ← barrel export
```

These become internal utilities consumed by notation functions (`note()`, `chord()`, `key()`, `roman()`).

---

## 7. Migration Strategy

### Phase 1: Copy + Deprecate

1. Copy all string-based functions to `packages/composer/src/notation/`
2. Update imports in composer to use local copies
3. Mark originals in theory as `@deprecated`

### Phase 2: Update Consumers

1. Update all tests and code that import string functions from `@symphonyscript/theory`
2. Redirect to `@symphonyscript/composer` or use numeric APIs directly

### Phase 3: Remove from Theory

1. Delete deprecated string functions from theory
2. Theory's `pitch/` module shrinks to `pitch.ts` (pure math) only
3. `midi.ts` retains only constants (`MIDI_CC`, `GM_DRUM`, `GM_PROGRAM`) and branded number types

---

## 8. Impact on RFC-058

Bridge methods like `withScale(root, mode)` take `PitchClass` enum + `ScaleMode` enum — no strings. Notation functions (the outermost layer) parse strings and call bridge methods with resolved enums:

```typescript
// Notation function (in composer)
function scale(root: string, mode: string): PipeStep {
  const pc = parsePitchName(root)    // string → PitchClass (from notation/)
  const sm = parseScaleMode(mode)    // string → ScaleMode (from notation/)
  return step((bridge) => bridge.withScale(pc, sm))
}

// Bridge method (pure enums)
withScale(root: PitchClass, mode: ScaleMode): CompositionBridge
```

---

## Appendix: Decision Log

| # | Decision | Rationale |
|:---|:---|:---|
| 1 | Theory = math + enums only | Representation is not theory. Different notation systems exist |
| 2 | String parsing moves to composer | Notation functions own the parsing. Bridge receives resolved values |
| 3 | Copy-then-deprecate migration | Non-breaking. Consumers migrate at their own pace |
| 4 | Place in `composer/src/notation/` | Co-located with notation functions that consume them |
| 5 | Theory retains MIDI constants | `MIDI_CC`, `GM_DRUM`, `GM_PROGRAM` are numeric constants, not string parsing |
| 6 | Theory retains branded number types | `MidiChannel`, `MidiValue` are number brands, not string concerns |
