# Implementation: Task 023

## Changes

- `packages/composer/src/clips/SynapticMelody.ts`: Added:
  - `roman(numeral, duration?)` method - creates chord from roman numeral in key context
  - `progression(numerals, options?)` method - emits sequence of chords from roman numerals
  - Import of `romanToChord` from adapter utility
- `packages/composer/src/utils/romanAdapter.ts`: Created with:
  - `NOTE_TO_KEY_ROOT` mapping (string note names to KEY_ROOT keys)
  - `toTheoryKeyContext(keyContext)` - converts composer's string-based KeyContext to theory's Interval24EDO-based KeyContext
  - `romanToChord(numeral, keyContext)` - wraps theory's romanToChord with string-based KeyContext
- `packages/theory/src/harmony/index.ts`: Added exports for `romanToChord`, `degreeToRoot`, `progressionToChords`
- `packages/composer/src/index.ts`: Added exports for `romanToChord`, `toTheoryKeyContext`
- `packages/composer/src/__tests__/roman.test.ts`: Created comprehensive test suite (30 tests)

## Acceptance Criteria

- [x] `roman('I')` returns chord cursor with root chord
- [x] `roman('ii')` returns minor chord cursor
- [x] `roman('V7')` returns dominant 7th chord cursor
- [x] `progression(['I', 'IV', 'V', 'I'])` emits 4 chords
- [x] Throws if `key()` not set
- [x] Works with different keys (C major, G major, A minor, D major, F major)
- [x] Tests pass (30/30)
- [x] No TODO/FIXME comments
- [x] No console.log statements

## Verify

```bash
pnpm test -- --run roman.test.ts
```

Output:
```
PASS @symphonyscript/composer src/__tests__/roman.test.ts
  Roman numeral methods
    roman()
      ✓ throws if key() not set
      ✓ returns chord cursor for I in C major
      ✓ roman("I") returns root chord cursor
      ✓ roman("ii") returns minor chord cursor
      ✓ roman("V7") returns dominant 7th chord cursor
      ✓ accepts optional duration
      ✓ throws for invalid roman numeral
    progression()
      ✓ throws if key() not set
      ✓ emits 4 chords for I-IV-V-I
      ✓ uses specified duration for each chord
      ✓ advances tick position between chords
      ✓ throws for invalid numeral in progression
      ✓ returns this for chaining
    works with different keys
      ✓ G major: roman("I") gives G major chord
      ✓ F major: roman("IV") gives Bb major chord
      ✓ A minor: roman("i") gives A minor chord
      ✓ D major: roman("vi") gives B minor chord
    modal interchange
      ✓ bVII in C major gives Bb major
  romanToChord adapter
    ✓ converts I in C major to C
    ✓ converts ii in C major to Dm
    ✓ converts V7 in C major to G7
    ✓ converts IV in G major to C
    ✓ converts bVII in C major to Bb
    ✓ returns null for invalid numeral
    ✓ returns null for invalid key root
  toTheoryKeyContext
    ✓ converts C major
    ✓ converts G major
    ✓ converts F# minor
    ✓ converts Bb major
    ✓ returns null for invalid root

Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
```

Note: Pre-existing flaky test `SynapticChordCursor.test.ts › Zero-Allocation Smoke Test` (memory threshold) still occasionally fails - unrelated to this implementation.
