# Directive: Task 007

## Task
Fix `voice.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses:
- `Clip.clip()` — **Removed** in Task 001
- `.voice()` — **Not implemented** (Task 036)
- `.stack()` — **Not implemented** (Task 010)

These features are LOW/MEDIUM priority and not yet implemented.

## Decision

**Delete the test file.**

Rationale:
- Tests depend on features that don't exist yet
- When `.voice()` is implemented (Task 036), tests should be written alongside
- Keeping broken tests provides no value

## Requirements

1. Delete `packages/composer/src/__tests__/voice.test.ts`

## Acceptance

- [ ] File deleted
- [ ] No module resolution or test errors for `voice.test.ts`
