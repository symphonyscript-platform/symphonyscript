# Task 035: Implement Parameter Automation

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No parameter automation system.

## Current State

No `automate()`, `volume()`, `pan()` methods exist.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:725-740
automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: 'linear' | 'exponential' | 'smooth'): this {
    return this.addOp(Actions.automation(target, value, rampBeats, curve))
}

volume(value: number, rampBeats?: number): this {
    return this.automate('volume', value, rampBeats)
}

pan(value: number, rampBeats?: number): this {
    return this.automate('pan', value, rampBeats)
}
```

## Required Implementation

1. Add `AutomationOp` type
2. Add `AutomationTarget` type ('volume' | 'pan' | 'filter' | etc.)
3. Implement `automate(target, value, rampBeats, curve)`
4. Implement `volume(value, rampBeats)` shorthand
5. Implement `pan(value, rampBeats)` shorthand
6. Add escape methods to cursor

## Example

```typescript
melody
    .volume(0.5)
    .note('C4').commit()
    .volume(1.0, 2)  // Ramp to full over 2 beats
    .pan(-0.5)       // Pan left
```

## Acceptance Criteria

- [ ] `automate(target, value)` works
- [ ] `volume(value)` works
- [ ] `pan(value)` works
- [ ] Ramp duration works
- [ ] Curve types work
- [ ] Tests for automation
