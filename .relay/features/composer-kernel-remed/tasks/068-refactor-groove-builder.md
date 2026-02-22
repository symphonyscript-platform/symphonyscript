# Task 068: Refactor SynapticGrooveBuilder Allocations

**Priority:** HIGH  
**Category:** Zero-Allocation Remediation  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`SynapticGrooveBuilder.build()` allocates:
- Returns object literal `{ stepsPerBeat, swing, velocities, ... }`
- `.slice()` on Float32Arrays creates new typed arrays

## Current State

```typescript
// SynapticGrooveBuilder.ts
build(): GrooveTemplate {
    return {
        stepsPerBeat: this._stepsPerBeat,
        swing: this._swing,
        velocities: this.velocities.slice(0, this.count),  // ❌ New array
        durations: this.durations.slice(0, this.count),    // ❌ New array
        offsets: this.offsets.slice(0, this.count),        // ❌ New array
        probabilities: this.probabilities.slice(0, this.count),
        length: this.count
    };
}
```

## Required Implementation

### Option A: Return view instead of copy

```typescript
build(): GrooveTemplateView {
    return {
        stepsPerBeat: this._stepsPerBeat,
        swing: this._swing,
        velocities: this.velocities.subarray(0, this.count),  // View, no copy
        durations: this.durations.subarray(0, this.count),
        offsets: this.offsets.subarray(0, this.count),
        probabilities: this.probabilities.subarray(0, this.count),
        length: this.count
    };
}
```

### Option B: Flush directly to Kernel

```typescript
// Instead of building an object, write groove to Kernel's groove table
flushToKernel(grooveId: number): this {
    for (let i = 0; i < this.count; i++) {
        this.bridge.setGrooveStep(grooveId, i, 
            this.velocities[i], 
            this.durations[i], 
            this.offsets[i], 
            this.probabilities[i]
        );
    }
    return this;
}
```

### Option C: MARK as design-time only

Groove building happens once during clip setup. Accept allocation.

## Files to Modify

- `[MODIFY] packages/composer/src/groove/SynapticGrooveBuilder.ts`

## Dependencies

- None (can be done independently)

## Acceptance Criteria

- [ ] `build()` refactored to not allocate arrays OR marked design-time
- [ ] If using views: document that views are invalidated on builder reuse
- [ ] If flushing to Kernel: Kernel groove table API exists
- [ ] `pnpm build && pnpm test` passes
