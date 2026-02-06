# Implementation: Task 045

## Changes

- `packages/theory/src/harmony/progressions.ts`: Added tritone substitution functions:
  - `tritoneSubstitute(root: string): string` — returns root 6 semitones away using flat notation
  - `applyTritoneSubstitutions(chords: string[]): string[]` — substitutes dominant 7th chords
- `packages/theory/src/harmony/index.ts`: Added exports for new functions
- `packages/theory/src/__tests__/progressions.test.ts`: Added 17 new tests

## Implementation Details

### tritoneSubstitute
- Uses frozen lookup table for zero-allocation (string lookup only)
- Maps each root to its tritone substitute using jazz convention (flat notation)
- Handles case variations (normalizes input)
- Returns original for unknown roots

### applyTritoneSubstitutions
- Uses regex pattern `/^([A-G][#b]?)7$/` to detect dominant 7th chords
- Only substitutes dominant 7th chords (G7, D7, etc.)
- Preserves other chord types (maj7, m7, dim7, triads)
- Returns new array without modifying input

## Verification

```
pnpm --filter @symphonyscript/theory build
✓ built in 146ms

pnpm --filter @symphonyscript/theory test
Test Suites: 15 passed, 15 of 16 total
Tests: 661 passed, 663 total (2 skipped)
```

All acceptance criteria met:
- [x] `tritoneSubstitute('G')` returns `'Db'`
- [x] `applyTritoneSubstitutions(['Dm7', 'G7', 'Cmaj7'])` returns `['Dm7', 'Db7', 'Cmaj7']`
- [x] Only dominant 7th chords are substituted
- [x] Tests created (17 new tests)
- [x] Build and tests pass
