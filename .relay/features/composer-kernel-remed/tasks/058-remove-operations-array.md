# Task 058: Remove Operations Array

**Priority:** CRITICAL  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

`SynapticClip` maintains `operations: Operation[]` array, pushing object literals on every note/cc. This violates zero-allocation and duplicates Kernel state.

## Current State

```typescript
// SynapticClip.ts
protected operations: ClipOperation[] = [];

// In flushNote():
this.operations.push({
    kind: 'note',
    pitch, velocity, duration, tick, muted, sourceId
});
```

## Required Implementation

1. **Delete** `protected operations: ClipOperation[] = []`
2. **Remove** all `.push()` calls in hot paths
3. **Remove** `build()` method that depends on operations
4. **Remove** or refactor `toOperations()`, `freeze()`, `play()`, `loop()` methods

The Kernel state is the single source of truth. If serialization is needed, read from Kernel.

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/clips/SynapticDrums.ts`
- `[DELETE or REFACTOR] packages/composer/src/clips/FrozenClip.ts`

## Dependencies

- **Depends on:** Task 057 (State must be flattened first)

## Acceptance Criteria

- [ ] `operations` array completely removed from `SynapticClip`
- [ ] No `.push({...})` calls in any clip class
- [ ] `flushNote()` writes directly to Kernel via `bridge.insertAsync()`
- [ ] All methods that depended on `operations` either removed or refactored
- [ ] `pnpm build && pnpm test` passes
