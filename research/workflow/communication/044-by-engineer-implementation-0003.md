# Implementation: Task 044

## Changes

- `packages/theory/src/pitch/intervals.ts`: Created new file with three zero-allocation interval functions:
  - `getIntervalQuality(semitones, generic)` → `'P' | 'M' | 'm' | 'A' | 'd'`
  - `invertInterval(semitones)` → number (12 - semitones % 12)
  - `isEnharmonic(a, b)` → boolean (same pitch class mod 12)
- `packages/theory/src/pitch/index.ts`: Added export for intervals module
- `packages/theory/src/__tests__/intervals.test.ts`: Created 48 comprehensive tests

## Implementation Details

### getIntervalQuality
- Handles perfect intervals (1, 4, 5, 8): returns P, A, or d
- Handles major/minor intervals (2, 3, 6, 7): returns M, m, A, or d
- Uses lookup constants for perfect and major semitone values
- Zero-allocation: pure arithmetic, no objects/arrays

### invertInterval
- Returns complement within octave: (12 - semitones % 12) % 12
- Handles negative and >12 semitones correctly
- Zero-allocation: pure arithmetic

### isEnharmonic
- Compares pitch classes: (a % 12) === (b % 12)
- Handles negative pitches and octave equivalents
- Zero-allocation: pure arithmetic

## Verification

```
pnpm --filter @symphonyscript/theory build
✓ built in 141ms

pnpm --filter @symphonyscript/theory test
Test Suites: 15 passed, 15 of 16 total
Tests: 644 passed, 646 total (2 skipped)
```

All acceptance criteria met:
- [x] Three functions implemented
- [x] Exported from pitch module
- [x] Tests created (48 tests)
- [x] Build passes
- [x] Tests pass
