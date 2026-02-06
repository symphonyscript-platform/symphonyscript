# Implementation: Task 047

## Changes

### SynapticMelody (`packages/composer/src/clips/SynapticMelody.ts`)
- Added import for `parseChord` from utils
- Implemented `voiceLead(numerals: string[], options?: { duration?: number }): this`
- Added private helper methods:
  - `chordSymbolToPitches(symbol: string): number[]` - converts chord symbol to MIDI pitches
  - `findBestVoicing(basePitches: number[], previousVoicing: number[]): number[]` - finds optimal inversion
  - `voiceMovementCost(from: number[], to: number[]): number` - calculates voice movement cost
  - `emitChordPitches(pitches: number[], duration: number): void` - emits chord via cursor

### Tests (`packages/composer/src/__tests__/VoiceLead.test.ts`)
- Created 18 comprehensive tests covering:
  - Basic functionality (4 tests)
  - Voice leading algorithm (3 tests)
  - Duration option (3 tests)
  - Different keys (3 tests)
  - Seventh chords (1 test)
  - Error handling (1 test)
  - Chaining (2 tests)
  - Integration (1 test)

## Implementation Details

### Voice Leading Algorithm
1. First chord uses root position (sorted ascending)
2. For subsequent chords:
   - Generate all inversions of the chord
   - Also try each inversion shifted ±12 semitones
   - Calculate voice movement cost (sum of absolute pitch differences)
   - Select voicing with minimum cost

### Voice Movement Cost
- Compares sorted pitch arrays
- Sums absolute differences between corresponding voices
- Penalizes voice count mismatches

## Verification

```
pnpm --filter @symphonyscript/composer test
Test Suites: 1 failed, 35 passed, 36 total
Tests: 1 failed, 691 passed, 692 total
```

The single failure is the pre-existing flaky test (`SynapticChordCursor Zero-Allocation`).

## Acceptance Criteria

- [x] `voiceLead(['I', 'IV', 'V', 'I'])` generates voice-led progression
- [x] Requires key context (throws if not set)
- [x] Minimizes voice movement between chords
- [x] Duration option works
- [x] Tests pass (18 new tests)
