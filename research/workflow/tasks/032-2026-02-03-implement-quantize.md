# Task 032: Implement quantize()

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No snap-to-grid timing correction.

## Current State

No `quantize()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:257-263
quantize(grid: NoteDuration, options?: { strength?: number; duration?: boolean }): this {
    return this._withParams({
        quantize: { grid, ...options }
    })
}
```

## Required Implementation

1. Add `QuantizeSettings` type
2. Add `quantize` to SynapticClip state
3. Implement `quantize(grid, options)` method
4. Apply in `flushNote()` before groove/humanize

## Pipeline Order

```
Quantize → Groove → Humanize
(Fix)      (Style)  (Random)
```

## Example

```typescript
melody
    .quantize('16n', { strength: 0.8 })
    .note('C4').commit()  // Snapped to 16th grid at 80% strength
```

## Acceptance Criteria

- [ ] `quantize('16n')` snaps to grid
- [ ] `strength` parameter works (0-1)
- [ ] `duration` option quantizes note length
- [ ] Applied before groove/humanize
- [ ] Tests for quantize
