# Implementation: Task 018

## Changes

### Modified `packages/composer/src/cursors/SynapticDrumHitCursor.ts`
- Added `openHat(duration?)` — emits pitch 46 (A#1)
- Added `crash(duration?)` — emits pitch 49 (C#2)
- Added `ride(duration?)` — emits pitch 51 (D#2)
- Added `tom(which: 1|2|3 = 1, duration?)` — emits pitch 48/45/43 (C2/A1/G1)

### Modified `packages/composer/src/clips/SynapticDrums.ts`
- Added `openHat(duration?)` entry point
- Added `crash(duration?)` entry point
- Added `ride(duration?)` entry point
- Added `tom(which: 1|2|3 = 1, duration?)` entry point

### Modified `packages/composer/src/__tests__/SynapticDrums.test.ts`
- Added test: openHat() emits pitch 46
- Added test: crash() emits pitch 49
- Added test: ride() emits pitch 51
- Added test: tom(1) emits pitch 48
- Added test: tom(2) emits pitch 45
- Added test: tom(3) emits pitch 43
- Added test: tom() defaults to tom(1)
- Added test: cursor chaining works with new methods

## Verify
```
cd packages/composer && pnpm exec jest SynapticDrums.test.ts
```
Output: 12 passed, 12 total

## Acceptance
- [x] `openHat()` emits pitch 46
- [x] `crash()` emits pitch 49
- [x] `ride()` emits pitch 51
- [x] `tom(1)` emits pitch 48, `tom(2)` = 45, `tom(3)` = 43
- [x] Cursor chaining: `drums.kick().openHat().commit()`
- [x] Tests pass (12/12)
