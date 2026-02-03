# Directive: Task 012

## Task
Fix `music-os.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses multiple unimplemented APIs:
- `Clip.clip()` — **Removed** in Task 001
- `.key()` — **Not implemented**
- `.octave()` — **Not implemented** (Task 017)
- `.chord([array])` — **Not implemented** (only `chord(symbol)` exists)
- `.play(clip)` — **Not implemented** (Task 016)
- `.getNode()` — **Not implemented**
- Import from `@symphonyscript/core/linker` — **Invalid path**

## Decision

**Delete the test file.**

Rationale:
- Too many unimplemented dependencies
- End-to-end integration test should be rewritten when APIs are complete
- Cannot partially fix — requires complete rewrite

## Requirements

1. Delete `packages/composer/src/__tests__/music-os.test.ts`

## Acceptance

- [ ] File deleted
