# Task 031: Implement defaultHumanize()

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to set clip-level humanization context.

## Current State

`humanize()` exists on cursors but not as clip-level default.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:243-245
defaultHumanize(settings: HumanizeSettings): this {
    return this._withParams({ humanize: settings })
}
```

## Required Implementation

1. Add `humanize` settings to SynapticClip state
2. Implement `defaultHumanize(settings)` method
3. Apply to all notes in `flushNote()` unless overridden

## Example

```typescript
melody
    .defaultHumanize({ timing: 10, velocity: 0.05, seed: 42 })
    .note('C4').commit()              // Humanized
    .note('D4').precise().commit()    // Not humanized (override)
```

## Acceptance Criteria

- [ ] `defaultHumanize({...})` sets context
- [ ] All notes receive humanization by default
- [ ] `precise()` on cursor overrides
- [ ] Seed produces deterministic results
- [ ] Tests for humanize context
