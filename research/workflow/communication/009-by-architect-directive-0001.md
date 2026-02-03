# Directive: Task 009

## Task
Fix `groove-integration.test.ts` — tests use APIs that don't exist.

## Analysis

The test file uses:
- `Clip.clip()` — **Removed** in Task 001
- `clip.use(groove)` — **Not implemented** on SynapticClip

`SynapticGrooveBuilder` exists and works, but groove integration (`.use()` method) is not implemented on clips.

## Decision

**Delete the test file.**

Rationale:
- `Clip.clip()` removed
- `.use()` method not implemented on clips
- When groove integration is implemented, tests should be written alongside

## Requirements

1. Delete `packages/composer/src/__tests__/groove-integration.test.ts`

## Note
`SynapticGrooveBuilder.test.ts` remains — it tests the builder in isolation and does not depend on removed APIs.

## Acceptance

- [ ] File deleted
