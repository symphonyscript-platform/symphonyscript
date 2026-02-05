# Implementation: Task 029

## Changes

### `packages/composer/src/types.ts`
- Added `ArpPattern` type: `'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge'`
- Added `ArpeggioOptions` interface:
  - `pattern?: ArpPattern` (default: 'up')
  - `velocity?: number` (default: 0.8)
  - `gate?: number` (0-1, default: 0.8)
  - `octaves?: number` (default: 1)
  - `seed?: number` (for reproducible random)

### `packages/composer/src/clips/SynapticMelody.ts`
- Imported `SeededRandom` from `@symphonyscript/core`
- Imported `parsePitch` for string pitch conversion
- Added `arpeggiate(pitches, rate, options?)` method:
  - Converts pitches to MIDI numbers
  - Expands across octaves if `octaves > 1`
  - Applies pattern ordering via `applyArpPattern()`
  - Calculates note duration as `rate * gate`
  - Plays notes sequentially
- Added private `applyArpPattern()` helper:
  - `up`: ascending sort
  - `down`: descending sort
  - `upDown`: up then down (no duplicate at peak)
  - `downUp`: down then up (no duplicate at bottom)
  - `random`: Fisher-Yates shuffle with SeededRandom
  - `converge`: outer → inner (first, last, second, second-last, ...)
  - `diverge`: inner → outer (middle outward)

### `packages/composer/src/index.ts`
- Added exports for `ArpPattern` and `ArpeggioOptions`

### `packages/composer/src/__tests__/Arpeggio.test.ts` (created)
- 22 comprehensive tests covering:
  - Basic functionality (sequential notes, tick advancement, gate, velocity)
  - All 7 patterns (up, down, upDown, downUp, random, converge, diverge)
  - Reproducible random with seed
  - Multi-octave expansion (2 and 3 octaves)
  - Clip factory integration
  - Edge cases (single note, numeric pitches, mixed pitches)

## Verification

```
pnpm build && pnpm test -- Arpeggio
```

Output:
```
Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

Full composer test suite: 338 pass, 1 pre-existing flaky test fails (Zero-Allocation Smoke Test - unrelated to this task)

Build: PASS
Tests: PASS (22 new Arpeggio tests)
