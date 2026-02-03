# Task 009: Rewrite groove-integration.test.ts to Use Current API

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
packages/composer/src/__tests__/groove-integration.test.ts
```

## Evidence

```
TypeError: this.builder.addNote is not a function
```

## Impact

- 3 tests fail
- Groove integration not tested

## Remediation

Rewrite tests to use the current cursor-based API.

## Acceptance Criteria

- [ ] Tests import from current implementations
- [ ] Tests use cursor-based API
- [ ] All groove integration tests pass
