# M-003: patchMultiple/patchSourceId Tests Fix

**Fix ID:** M-003
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

`patchMultiple` and `patchSourceId` methods existed in `AttributePatcher` but were not exposed by `SiliconSynapse` and had no test coverage.

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`
- `packages/kernel/src/__tests__/silicon-linker.test.ts`

## Changes Made

### 1. Exposed Methods in `SiliconSynapse` (lines ~418-449)

Added two new public methods:

```typescript
/**
 * Patch the sourceId field of a node.
 * M-003: Exposed for testing and advanced use cases.
 */
patchSourceId(ptr: NodePtr, sourceId: number): boolean {
  return this.patcher.patchSourceId(ptr, sourceId)
}

/**
 * Patch multiple attributes of a node in a single operation.
 * M-003: Exposed for testing and batch updates.
 *
 * Bumps SEQ counter once for all updates (efficient versioning).
 */
patchMultiple(ptr: NodePtr, updates: {
  pitch?: number
  velocity?: number
  duration?: number
  baseTick?: number
  muted?: boolean
  sourceId?: number
}): boolean {
  return this.patcher.patchMultiple(ptr, updates)
}
```

### 2. Added 8 New Tests in `silicon-linker.test.ts`

**patchSourceId tests:**
- `should patch sourceId` - verifies sourceId is updated
- `should return false for patchSourceId with invalid pointer`

**patchMultiple tests:**
- `should patch multiple attributes in one call` - tests pitch, velocity, duration, baseTick
- `should patch single attribute via patchMultiple` - verifies other values unchanged
- `should patch muted flag via patchMultiple`
- `should patch sourceId via patchMultiple`
- `should return false for patchMultiple with invalid pointer`
- `should clamp values in patchMultiple` - verifies pitch/velocity clamping

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
```

**PASS** (8 new tests added)

## Notes

- `patchMultiple` is efficient because it bumps the SEQ counter only once for all updates
- Both methods delegate to the internal `AttributePatcher` class
- Clamping behavior is inherited from individual patch methods
