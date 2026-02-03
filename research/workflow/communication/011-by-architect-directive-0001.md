# Directive: Task 011

## Task
Fix `harmony.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses:
- `Clip.clip()` — **Removed** in Task 001
- `clip.harmony(mask, root, duration)` — **Not implemented** on clips

## Decision

**Delete the test file.**

Rationale:
- `Clip.clip()` removed
- `.harmony()` method not implemented on clips
- Tests will be written when harmony features are implemented

## Requirements

1. Delete `packages/composer/src/__tests__/harmony.test.ts`

## Acceptance

- [ ] File deleted
