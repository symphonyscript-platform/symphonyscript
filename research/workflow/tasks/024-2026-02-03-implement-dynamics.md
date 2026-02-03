# Task 024: Implement Dynamics (Crescendo/Decrescendo)

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to create gradual volume changes.

## Current State

No dynamics methods exist.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:652-706
crescendo(duration: NoteDuration, options?): this {
    const op: DynamicsOp = {
        kind: 'dynamics',
        type: 'crescendo',
        from: options?.from ?? 0.3,
        to: options?.to ?? 1.0,
        duration,
        curve: options?.curve
    }
    return this.addOp(op)
}

decrescendo(duration: NoteDuration, options?): this {
    // Similar...
}

velocityRamp(to: number, duration: NoteDuration, options?): this
velocityCurve(points: VelocityPoint[], duration: NoteDuration): this
```

## Required Implementation

1. Add `DynamicsOp` type
2. Add `VelocityPoint` type
3. Implement `crescendo(duration, options)`
4. Implement `decrescendo(duration, options)`
5. Implement `velocityRamp(to, duration, options)`
6. Implement `velocityCurve(points, duration)`

## Acceptance Criteria

- [ ] `crescendo('2n')` increases volume over 2 beats
- [ ] `decrescendo('1n', { from: 1, to: 0.2 })` works
- [ ] `velocityRamp(0.8, '4n')` works
- [ ] `velocityCurve([...], '4n')` works
- [ ] Escape methods on cursors
- [ ] Tests for dynamics
