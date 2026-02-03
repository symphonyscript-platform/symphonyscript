# Task 007: Rewrite voice.test.ts to Use Current API

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
packages/composer/src/__tests__/voice.test.ts
```

## Evidence

```
TypeError: this.builder.addNote is not a function

    at SynapticClip.addNote [as note] (../../../legacy/symphonyscript/packages/composer/src/legacy-synaptic/SynapticClip.ts:152:22)
```

## Impact

- 7 tests fail
- Voice/MPE functionality not tested

## Root Cause

Tests import from legacy path which has incompatible API.

## Remediation

Rewrite tests to use the current cursor-based API:

```typescript
// Before (legacy API)
melody.note('C4', '4n');  // calls addNote internally

// After (current API)
melody.note('C4', '4n').commit();  // cursor-based
```

## Acceptance Criteria

- [ ] Tests import from current implementations, not legacy
- [ ] Tests use cursor-based API (`.note().commit()`)
- [ ] All voice tests pass
