# Implementation: Task 016

## Changes

### Modified `packages/composer/src/types.ts`
- Added `ClipOp` interface with `kind: 'clip'`, `clip: ClipNode`
- Updated `ClipNode.operations` to accept `(NoteOperation | LoopOp | ClipOp)[]`

### Modified `packages/composer/src/clips/SynapticMelody.ts`
- Added import: `ClipNode` from `../types`
- Added `play(clip: SynapticMelody | ClipNode)` method:
  - Accepts either a SynapticMelody or ClipNode
  - Extracts operations from source (calls `build()` if SynapticMelody)
  - Inserts note operations at current tick offset
  - Generates new sourceIds for inserted operations
  - Advances tick by source clip duration

### Created `packages/composer/src/__tests__/play.test.ts`
- Test: inserts operations from another SynapticMelody
- Test: inserts operations from a ClipNode
- Test: offsets operations by current tick position
- Test: advances tick by source clip duration
- Test: returns this for chaining
- Test: handles empty source clip
- Test: generates new sourceIds for inserted operations

## Verify
```
cd packages/composer && pnpm exec jest play.test.ts
```
Output: 7 passed, 7 total

## Acceptance
- [x] `ClipOp` type defined
- [x] `play(clip)` inserts operations at current tick
- [x] Tick advances by source clip duration
- [x] Tests pass (7/7)
- [x] No new TypeScript errors
