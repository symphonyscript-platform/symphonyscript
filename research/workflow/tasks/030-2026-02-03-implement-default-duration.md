# Task 030: Implement defaultDuration()

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to set default duration for notes without explicit duration.

## Current State

No `defaultDuration()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:97-99
defaultDuration(duration: NoteDuration): this {
    return this._withParams({ defaultDuration: duration })
}
```

## Required Implementation

1. Add `defaultDuration` to SynapticClip state
2. Implement `defaultDuration(duration)` method
3. Use in `note()` when duration not specified

## Example

```typescript
melody
    .defaultDuration('8n')
    .note('C4').commit()      // 8n
    .note('D4').commit()      // 8n
    .note('E4', '4n').commit() // 4n (explicit override)
```

## Acceptance Criteria

- [ ] `defaultDuration('8n')` sets context
- [ ] Notes without duration use default
- [ ] Explicit duration overrides default
- [ ] Tests for default duration
