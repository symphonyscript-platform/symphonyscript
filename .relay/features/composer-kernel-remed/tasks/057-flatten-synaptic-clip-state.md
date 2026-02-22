# Task 057: Flatten SynapticClip State to Primitives

**Priority:** CRITICAL  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

`SynapticClip` stores state as objects, violating zero-allocation principles:
- `activeDynamics`: `{ type, start, duration, from, to }`
- `scaleContext`: `{ root, mode, octave }`
- `_humanizeSettings`: `{ velocity, timing }`

These cause allocations on every state mutation.

## Current State

```typescript
// SynapticClip.ts
protected activeDynamics: DynamicsState | null = null;
protected scaleContext: ScaleContext | null = null;
protected _humanizeSettings = { velocity: 0, timing: 0 };
```

## Required Implementation

Replace object fields with primitive numbers/enums:

```typescript
// Dynamics (flattened)
protected _dynType: DynamicsType = DynamicsType.NONE;
protected _dynStart: number = 0;
protected _dynDuration: number = 0;
protected _dynFrom: number = 0;
protected _dynTo: number = 0;

// Scale (flattened)
protected _scaleRoot: number = -1;  // -1 = no scale
protected _scaleMode: ScaleMode = ScaleMode.NONE;
protected _scaleOctave: number = 4;

// Humanize (flattened)
protected _humVel: number = 0;
protected _humTiming: number = 0;
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/types.ts` (add enums if needed)

## Dependencies

- **Depends on:** Task 059 (Enums must exist first)

## Acceptance Criteria

- [ ] All object-based state fields replaced with primitives
- [ ] No `{}` allocations in state mutation methods
- [ ] All getter/setter methods updated to use primitives
- [ ] All subclasses (`SynapticMelody`, `SynapticDrums`) compatible
- [ ] `pnpm build && pnpm test` passes
