# Task 008: Rewrite timing.test.ts to Use Current API

**Priority:** CRITICAL  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Test file uses legacy `addNote()` API which doesn't exist on current `SynapticNode`.

## Location

```
packages/composer/src/__tests__/timing.test.ts
```

## Evidence

```
TypeError: this.builder.addNote is not a function
```

## Impact

- 4 tests fail
- Timing methods (wait, shift, playbackOffset) not tested

## Remediation

Rewrite tests to use the current cursor-based API:

```typescript
// Before (legacy API)
clip.note('C4', '4n');

// After (current API)  
clip.note('C4', '4n').commit();
```

## Acceptance Criteria

- [ ] Tests import from current implementations
- [ ] Tests use cursor-based API
- [ ] All timing tests pass
