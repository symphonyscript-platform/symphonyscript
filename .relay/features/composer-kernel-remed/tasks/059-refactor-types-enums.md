# Task 059: Refactor types.ts to Use Numeric Enums

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

`types.ts` uses string union types that force object allocations when used as state:
- `'major' | 'minor'`
- `'sharp' | 'flat' | 'natural'`
- `'linear' | 'exponential' | 'smooth'`

Interfaces like `ScaleContext`, `KeyContext`, `DegreeOptions` also force object creation.

## Current State

```typescript
// types.ts
export type ScaleMode = 'major' | 'minor' | 'dorian' | ...;
export type Accidental = 'sharp' | 'flat' | 'natural';

export interface ScaleContext {
    root: string;
    mode: ScaleMode;
    octave: number;
}
```

## Required Implementation

Replace with numeric enums:

```typescript
export const enum ScaleMode {
    NONE = 0,
    MAJOR = 1,
    MINOR = 2,
    DORIAN = 3,
    // ...
}

export const enum Accidental {
    NONE = 0,
    SHARP = 1,
    FLAT = 2,
    NATURAL = 3,
}

export const enum DynamicsType {
    NONE = 0,
    STATIC = 1,
    CRESCENDO = 2,
    DECRESCENDO = 3,
}

export const enum CurveType {
    LINEAR = 0,
    EXPONENTIAL = 1,
    SMOOTH = 2,
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/types.ts`

## Dependencies

- **None** (This task should be done first)

## Acceptance Criteria

- [ ] All string union types replaced with `const enum`
- [ ] Enums use numeric values (not string values)
- [ ] All consumers updated to use enum values
- [ ] No breaking API changes for external users
- [ ] `pnpm build && pnpm test` passes
