# Directive: Task 008

## Task
Fix `timing.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses:
- `Clip.clip()` — **Removed** in Task 001
- `.wait()` — **Not implemented**
- `.shift()` — **Not implemented**
- `.playbackOffset()` — **Not implemented**

These timing features are not yet implemented.

## Decision

**Delete the test file.**

Rationale:
- Tests depend on features that don't exist
- Tests will be written when timing features are implemented
- Keeping broken tests provides no value

## Requirements

1. Delete `packages/composer/src/__tests__/timing.test.ts`

## Acceptance

- [ ] File deleted
