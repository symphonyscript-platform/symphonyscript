# Task 063: Remove isolate() Closure Allocations

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`SynapticClip.isolate()` creates callback closures for temporary state isolation, causing allocations on every call.

## Current State

```typescript
// SynapticClip.ts
isolate(fn: (clip: this) => void): this {
    const savedState = { ...this.currentState };  // ❌ Object allocation
    fn(this);                                      // ❌ Closure allocation
    Object.assign(this, savedState);
    return this;
}
```

## Required Implementation

Replace closure-based isolation with explicit save/restore methods:

```typescript
// Option 1: Manual save/restore (zero-allocation)
pushState(): this {
    // Save primitives to pre-allocated stack slots
    this._stateStack[this._stackPtr++] = this._transpose;
    this._stateStack[this._stackPtr++] = this._velocity;
    // ...
    return this;
}

popState(): this {
    // Restore from stack
    this._velocity = this._stateStack[--this._stackPtr];
    this._transpose = this._stateStack[--this._stackPtr];
    return this;
}

// Usage:
clip.pushState()
    .transpose(12)
    .note(60).velocity(0.5).commit()
    .popState();
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`

## Dependencies

- **Depends on:** Task 057 (State must be primitives first)

## Acceptance Criteria

- [ ] `isolate()` method removed or refactored to not allocate
- [ ] `pushState()` / `popState()` implemented with pre-allocated stack
- [ ] No closure allocations in state isolation
- [ ] Stack overflow protection (max depth)
- [ ] `pnpm build && pnpm test` passes
