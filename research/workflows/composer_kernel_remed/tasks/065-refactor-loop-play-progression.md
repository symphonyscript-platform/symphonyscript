# Task 065: Refactor loop(), play(), progression() Methods

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

These methods use callbacks and options objects that allocate:
- `loop(count, fn)` - closure allocation
- `play(clip)` - may allocate if clip is builder
- `progression(numerals, { duration })` - options object allocation

## Current State

```typescript
// SynapticMelody.ts
loop(count: number, source: ((clip: SynapticMelody) => void) | OperationsSource): this {
    if (typeof source === 'function') {
        for (let i = 0; i < count; i++) {
            source(this);  // ❌ Closure called N times
        }
    }
}

progression(numerals: string[], options?: { duration?: number }): this {
    const { duration = 1 } = options ?? {};  // ❌ Object destructuring
}
```

## Required Implementation

### Option A: Direct parameters instead of options objects

```typescript
progression(numerals: string[], duration: number = 1): this {
    // No object allocation
}
```

### Option B: For loop(), accept only pre-built patterns

```typescript
// Remove callback variant entirely
// Only accept pre-compiled pattern references
loop(count: number, patternId: number): this {
    // Pattern retrieved from Kernel by ID
}
```

### Option C: Mark as "design-time only" if allocation is unavoidable

If these methods are only called during initial clip setup (not during playback), document clearly and accept the allocation.

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`

## Dependencies

- **Depends on:** Task 058 (Operations must be removed first)

## Acceptance Criteria

- [ ] `progression()` uses direct parameters, no options object
- [ ] `loop()` refactored to avoid closure allocations OR marked design-time only
- [ ] `play()` refactored to avoid allocations OR marked design-time only
- [ ] All design-time methods clearly documented with `@design-time` tag
- [ ] `pnpm build && pnpm test` passes
