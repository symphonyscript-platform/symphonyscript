# Task 011: Rewrite harmony.test.ts to Use Current API

**Priority:** CRITICAL  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Test file references `VoiceAllocator` which is not exported from `@symphonyscript/synaptic`.

## Location

```
packages/composer/src/__tests__/harmony.test.ts
```

## Evidence

```
TypeError: Cannot read properties of undefined (reading 'allocate')

    > 394 |         VoiceAllocator.allocate(mask as unknown as HarmonyMask, root, (pitch, expressionId) => {
          |                        ^
```

## Impact

- 2 tests fail
- Harmony/chord functionality not tested

## Remediation

Either:
1. Export `VoiceAllocator` from synaptic package
2. Rewrite tests to use `SynapticChordCursor.harmony()` method directly

**Recommendation:** Option 2 - test the public API, not internal implementation.

## Acceptance Criteria

- [ ] Tests don't reference `VoiceAllocator` directly
- [ ] Tests use `SynapticChordCursor` API
- [ ] All harmony tests pass
