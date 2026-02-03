# Implementation: Task 017

## Changes

### Modified `packages/composer/src/clips/SynapticClip.ts`
- Added `octave(n)` — sets absolute octave (4 = middle C, transposeOffset = (n-4)*12)
- Added `octaveUp(n = 1)` — shifts up by n*12 semitones
- Added `octaveDown(n = 1)` — shifts down by n*12 semitones

### Modified `packages/composer/src/cursors/ComposerCursor.ts`
- Added `octave(n)` escape — commits and calls clip.octave(n)
- Added `octaveUp(n = 1)` escape — commits and calls clip.octaveUp(n)
- Added `octaveDown(n = 1)` escape — commits and calls clip.octaveDown(n)

### Created `packages/composer/src/__tests__/octave.test.ts`
- octave(): 3 tests (octave 5, 3, 4)
- octaveUp(): 4 tests (1, 2, default, stacking)
- octaveDown(): 3 tests (1, 2, default)
- cursor escapes: 3 tests

## Verify
```
cd packages/composer && pnpm exec jest octave.test.ts
```
Output: 13 passed, 13 total

## Acceptance
- [x] `octave(5)` sets transpose to +12
- [x] `octave(3)` sets transpose to -12
- [x] `octaveUp(2)` adds +24 to transpose
- [x] `octaveDown(1)` adds -12 to transpose
- [x] Cursor escapes work
- [x] Tests pass (13/13)
