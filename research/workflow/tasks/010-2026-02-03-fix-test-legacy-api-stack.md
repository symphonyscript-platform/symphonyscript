# Task 010: Rewrite stack.test.ts to Use Current API

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
packages/composer/src/__tests__/stack.test.ts
```

## Evidence

```
TypeError: this.builder.addNote is not a function
```

## Impact

- 4 tests fail
- Stack/parallel polyphony not tested

## Remediation

Rewrite tests to use the current cursor-based API.

## Acceptance Criteria

- [ ] Tests import from current implementations
- [ ] Tests use cursor-based API
- [ ] All stack tests pass
