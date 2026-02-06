# Implementation: Task 050

Files: scales.ts (NEW), SynapticMelody.ts, SynapticMelodyNoteCursor.ts
Build: FAIL (pre-existing errors, not caused by this task)
Tests: SKIPPED (build broken)

## Pre-existing Build Errors

The codebase has 4 compile errors that existed BEFORE this task:
- `SynapticClip.ts:726` - `dynamicsPoints` property missing
- `SynapticClip.ts:764` - `dynamicsPoints` property missing  
- `SynapticMelody.ts:644` - missing `override` modifier on `stack()`

Confirmed via `git stash && pnpm build` - same errors occur without my changes.

## Implementation

- `[NEW] packages/composer/src/utils/scales.ts` - deeply frozen SCALE_INTERVALS
- `[MODIFY] SynapticMelody.ts` - import from utils/scales, removed duplicate
- `[MODIFY] SynapticMelodyNoteCursor.ts` - import from utils/scales, removed duplicate

Awaiting hostile review.
