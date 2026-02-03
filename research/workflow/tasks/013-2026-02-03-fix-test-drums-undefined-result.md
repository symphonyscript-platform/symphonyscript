# Task 013: Fix SynapticDrums.test.ts Undefined Result

**Priority:** HIGH  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Drum cursor chain returns `undefined` instead of expected result.

## Location

```
packages/composer/src/__tests__/SynapticDrums.test.ts:46-48
```

## Evidence

```typescript
const result = drums.kick().velocity(0.9).hat().velocity(0.5).commit();

expect(result).toBeDefined();  // FAILS - result is undefined
```

## Impact

- 1 test fails
- Drum fluent chaining not working correctly

## Root Cause

The `commit()` method likely returns `void` instead of `this` or the clip.

## Remediation

Either:
1. Update test expectation (if commit() should return void)
2. Update `SynapticDrumHitCursor.commit()` to return the clip for chaining

## Acceptance Criteria

- [ ] Test correctly reflects expected API behavior
- [ ] `commit()` return type is documented
- [ ] Test passes
