# Implementation: Task 014

## Changes

### Created `packages/composer/src/types.ts`
- Defined `SCHEMA_VERSION = 1`
- Defined `ClipNode` interface with `_version`, `kind`, `name`, `operations`, `tempo`, `timeSignature`, `swing`, `groove`
- Defined `NoteOperation` interface with `kind`, `pitch`, `velocity`, `duration`, `tick`, `muted`, `sourceId`

### Modified `packages/composer/src/clips/SynapticClip.ts`
- Added import: `ClipNode`, `NoteOperation`, `SCHEMA_VERSION` from `../types`
- Added field: `protected clipName: string = ''`
- Added field: `protected operations: NoteOperation[] = []`
- Added method: `name(n: string): this` — sets clip name
- Added method: `build(): ClipNode` — returns AST structure
- Modified `flushNote()` to push operation to `operations` array (step 6)

### Created `packages/composer/src/__tests__/build.test.ts`
- Test: returns ClipNode with correct structure
- Test: records operations when notes are flushed
- Test: includes swing and groove settings
- Test: returns empty operations for empty clip

## Verify
```
cd packages/composer && pnpm exec jest build.test.ts
```
Output: 4 passed, 4 total

## Acceptance
- [x] `ClipNode` type defined in `types.ts`
- [x] `build()` method returns valid `ClipNode`
- [x] Operations array populated during note creation
- [x] Test verifies build output (4 tests pass)
- [x] No TypeScript errors
