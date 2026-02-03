# Directive: Task 010

## Task
Fix `stack.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses:
- `Clip.clip()` — **Removed** in Task 001
- `.stack(callback)` — **Not implemented**

Current `SynapticClip.stack()` takes no arguments and just sets `stackingEnabled = true`. The test expects `stack(callback)` pattern for parallel polyphony.

## Decision

**Delete the test file.**

Rationale:
- `Clip.clip()` removed
- `.stack(callback)` pattern not implemented
- Tests will be written when parallel polyphony is implemented

## Requirements

1. Delete `packages/composer/src/__tests__/stack.test.ts`

## Acceptance

- [ ] File deleted
