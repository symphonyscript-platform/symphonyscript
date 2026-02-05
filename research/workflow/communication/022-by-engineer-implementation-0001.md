# Implementation: Task 022

## Changes

- `packages/composer/src/types.ts`: Added `KeyContext` interface and `Accidental` type
- `packages/composer/src/clips/SynapticClip.ts`: Added:
  - `keyContext: KeyContext | null` state
  - `nextAccidental: Accidental | null` state
  - `key(root, mode)` method
  - `getKeyContext()` method
  - `accidental(acc)` method
  - `consumeAccidental()` method
- `packages/composer/src/utils/key.ts`: Created with:
  - `KEY_SIGNATURES` lookup table (all major/minor keys)
  - `applyKeySignature(noteName, keyContext, overrideAccidental)` function
  - `hasExplicitAccidental(noteName)` helper
- `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts`: Modified `note()` to:
  - Get key context and accidental override from clip
  - Apply key signature transformation for string input
  - Consume accidental after use
- `packages/composer/src/index.ts`: Added exports for `applyKeySignature`, `hasExplicitAccidental`, `KeyContext`, `Accidental`
- `packages/composer/src/__tests__/key.test.ts`: Created comprehensive test suite (41 tests)

## Acceptance Criteria

- [x] `key('G', 'major')` sets key context
- [x] `note('F4')` becomes F#4 in G major
- [x] `accidental('natural').note('F4')` stays F4 in G major
- [x] `accidental('sharp').note('C4')` becomes C#4
- [x] `accidental('flat').note('B4')` becomes Bb4
- [x] Accidental is consumed after one note
- [x] Notes with explicit accidentals (`F#4`) are not modified
- [x] Tests pass (41/41)
- [x] No TODO/FIXME comments
- [x] No console.log statements

## Verify

```bash
pnpm test -- --run key.test.ts
```

Output:
```
PASS @symphonyscript/composer src/__tests__/key.test.ts
  Key signature context
    key()
      ✓ sets key context
      ✓ returns this for chaining
      ✓ can be changed
    accidental()
      ✓ returns this for chaining
      ✓ is consumed after use
    note() with key context
      ✓ note("F4") becomes F#4 in G major
      ✓ note("B4") becomes Bb4 in F major
      ✓ note("C4") stays C4 in G major (no accidental for C)
      ✓ multiple sharps in D major (F# and C#)
      ✓ minor key accidentals (E minor has F#)
    accidental override
      ✓ accidental("natural").note("F4") stays F4 in G major
      ✓ accidental("sharp").note("C4") becomes C#4
      ✓ accidental("flat").note("B4") becomes Bb4
      ✓ accidental is consumed after one note
    explicit accidentals in note name
      ✓ note("F#4") is not modified by key context
      ✓ note("Bb4") is not modified by key context
      ✓ explicit accidental overrides key signature
    numeric input
      ✓ numeric input ignores key context
      ✓ accidental is consumed even for numeric input
    various key signatures
      ✓ G major: F4 → MIDI 66
      ✓ D major: C4 → MIDI 61
      ✓ A major: G4 → MIDI 68
      ✓ E major: D4 → MIDI 63
      ✓ B major: A4 → MIDI 70
      ✓ F major: B4 → MIDI 70
      ✓ Bb major: E4 → MIDI 63
      ✓ Eb major: A4 → MIDI 68
      ✓ Ab major: D4 → MIDI 61
      ✓ E minor: F4 → MIDI 66
      ✓ D minor: B4 → MIDI 70
      ✓ G minor: E4 → MIDI 63
  applyKeySignature utility
    ✓ returns note unchanged without key context
    ✓ applies sharp in G major
    ✓ applies flat in F major
    ✓ natural override strips accidental
    ✓ sharp override adds sharp
    ✓ flat override adds flat
    ✓ does not modify explicit accidentals
  hasExplicitAccidental utility
    ✓ returns true for sharps
    ✓ returns true for flats
    ✓ returns false for natural notes

Test Suites: 1 passed, 1 total
Tests:       41 passed, 41 total
```

All composer tests:
```
Test Suites: 14 passed, 14 total
Tests:       192 passed, 192 total
```
