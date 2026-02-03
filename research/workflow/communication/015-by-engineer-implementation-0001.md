# Implementation: Task 015

## Changes

### Modified `packages/composer/src/types.ts`
- Added `LoopOp` interface with `kind: 'loop'`, `count`, `operations`
- Updated `ClipNode.operations` to accept `(NoteOperation | LoopOp)[]`

### Modified `packages/composer/src/clips/SynapticClip.ts`
- Renamed `loop(start, end)` to `setLoopRegion(start, end)`

### Modified `packages/composer/src/clips/SynapticMelody.ts`
- Added `loop(count, builderFn)` method that executes builder function `count` times

### Modified `packages/composer/src/cursors/ComposerCursor.ts`
- Renamed `loop()` escape method to `setLoopRegion()`

### Updated test mocks (4 files)
- `SynapticChordCursor.test.ts`: `loop` → `setLoopRegion`
- `SynapticMelodyNoteCursor.test.ts`: `loop` → `setLoopRegion`
- `SynapticNoteCursor.test.ts`: `loop` → `setLoopRegion`
- `SynapticCursor.test.ts`: `loop` → `setLoopRegion`

### Created `packages/composer/src/__tests__/loop.test.ts`
- Test: executes builder function count times
- Test: records operations for each iteration
- Test: advances tick across iterations with sequential notes
- Test: returns this for chaining
- Test: handles zero count

## Verify
```
cd packages/composer && pnpm exec jest loop.test.ts
```
Output: 5 passed, 5 total

## Note
`SynapticChordCursor.test.ts` has a pre-existing flaky heap allocation test unrelated to this task.

## Acceptance
- [x] `setLoopRegion(start, end)` replaces old `loop(start, end)`
- [x] `loop(count, fn)` executes builder function `count` times
- [x] Operations are recorded for each iteration
- [x] Tests pass (5/5)
- [x] No new TypeScript errors
