# RFC-047 Phase 9 Task 1: GrooveBuilder Mutable Pattern - Implementation Plan

**Date**: 2025-12-28T18:31:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-84-by-engineer-task1-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Refactor `GrooveBuilder` from immutable pattern (allocates new instances) to mutable pattern (**RFC-045-04 compliance**). Add `clone()` method for explicit branching.

---

## Current State Analysis (RFC-045-04 Violation)

### Current Implementation (`GrooveBuilder.ts`)

```typescript
export class GrooveBuilder {
    constructor(
        private readonly swingAmount: number = 0.5,
        private readonly stepCount: number = 4
    ) {
        // Validation in constructor
        if (swingAmount < 0 || swingAmount > 1) {
            throw new Error('Swing must be 0-1');
        }
        if (stepCount < 1) {
            throw new Error('Steps must be >= 1');
        }
    }

    swing(amount: number): GrooveBuilder {
        return new GrooveBuilder(amount, this.stepCount);  // ❌ ALLOCATES
    }

    steps(count: number): GrooveBuilder {
        return new GrooveBuilder(this.swingAmount, count);  // ❌ ALLOCATES
    }

    build(): Readonly<{ swing: number; steps: number }> {
        return Object.freeze({
            swing: this.swingAmount,
            steps: this.stepCount
        });
    }
}
```

**RFC-045-04 Violation**: `swing()` and `steps()` methods allocate new instances on every call, violating zero-allocation principle.

---

## Proposed Changes

### File: `packages/composer/src/GrooveBuilder.ts`

#### Change A: Remove `readonly` from Fields (Lines 9-10)

**Current**:
```typescript
constructor(
    private readonly swingAmount: number = 0.5,
    private readonly stepCount: number = 4
) {
```

**Modified**:
```typescript
constructor(
    private swingAmount: number = 0.5,
    private stepCount: number = 4
) {
```

**Rationale**: Fields must be mutable for in-place updates.

#### Change B: Refactor `swing()` to Mutable Pattern (Lines 25-27)

**Current**:
```typescript
/**
 * Set swing amount (0.5 = no swing, 0.66 = MPC swing).
 * Returns NEW instance (immutable).
 */
swing(amount: number): GrooveBuilder {
    return new GrooveBuilder(amount, this.stepCount);
}
```

**Modified**:
```typescript
/**
 * Set swing amount (0.5 = no swing, 0.66 = MPC swing).
 * Mutates this instance and returns this for chaining.
 * 
 * @param amount - Swing amount (0-1)

 * @returns this for fluent chaining
 */
swing(amount: number): this {
    // Validate before mutating
    if (amount < 0 || amount > 1) {
        throw new Error('Swing must be 0-1');
    }
    this.swingAmount = amount
    return this
}
```

#### Change C: Refactor `steps()` to Mutable Pattern (Lines 33-35)

**Current**:
```typescript
/**
 * Set step count (e.g., 16th notes per beat).
 * Returns NEW instance (immutable).
 */
steps(count: number): GrooveBuilder {
    return new GrooveBuilder(this.swingAmount, count);
}
```

**Modified**:
```typescript
/**
 * Set step count (e.g., 16th notes per beat).
 * Mutates this instance and returns this for chaining.
 * 
 * @param count - Steps per beat

 * @returns this for fluent chaining
 */
steps(count: number): this {
    // Validate before mutating
    if (count < 1) {
        throw new Error('Steps must be >= 1');
    }
    this.stepCount = count
    return this
}
```

#### Change D: Add `clone()` Method (after `steps()`, before `build()`)

**New method**:
```typescript
/**
 * Create a deep copy of this GrooveBuilder.
 * 
 * Use this for explicit branching when you need independent copies.
 * 
 * @returns New GrooveBuilder instance with same values
 * 
 * @example
 * const base = new GrooveBuilder().swing(0.55);
 * const variant = base.clone().steps(16);  // base unchanged
 */
clone(): GrooveBuilder {
    return new GrooveBuilder(this.swingAmount, this.stepCount)
}
```

#### Change E: Update File Header Comment (Lines 1-6)

**Current**:
```typescript
/**
 * Groove template for quantization and swing.
 * Immutable builder pattern per RFC-047 Section 4.1.
 * 
 * Uses constructor parameters for zero-allocation pattern.
 */
```

**Modified**:
```typescript
/**
 * Groove template for quantization and swing.
 * 
 * RFC-047 Phase 9: Mutable builder pattern with explicit clone().
 * Mutates in place for zero-allocation (RFC-045-04 compliance).
 */
```

---

## Tests to Modify/Add

### File: `packages/composer/src/__tests__/GrooveBuilder.test.ts`

#### Modify Existing Tests

**Test 2: "Immutability: .swing() returns new instance"** → **DELETE** (no longer immutable)

**Test 3: "Immutability: .build() returns frozen object"** → **KEEP** (build still frozen)

**Add New Tests**:

```typescript
describe('GrooveBuilder', () => {
    test('Default values', () => {
        const groove = new GrooveBuilder().build();
        expect(groove.swing).toBe(0.5);
        expect(groove.steps).toBe(4);
    });

    test('Mutability: .swing() mutates instance', () => {
        const g = new GrooveBuilder();
        const result = g.swing(0.66);
        expect(result).toBe(g);  // Returns this
        expect(g.build().swing).toBe(0.66);  // Mutated
    });

    test('Mutability: .steps() mutates instance', () => {
        const g = new GrooveBuilder();
        const result = g.steps(16);
        expect(result).toBe(g);  // Returns this
        expect(g.build().steps).toBe(16);  // Mutated
    });

    test('.clone() creates independent copy', () => {
        const g1 = new GrooveBuilder().swing(0.55);
        const g2 = g1.clone();
        
        expect(g1).not.toBe(g2);  // Different instances
        expect(g1.build().swing).toBe(0.55);
        expect(g2.build().swing).toBe(0.55);  // Same initial values
        
        // Mutate g2, g1 unchanged
        g2.swing(0.66);
        expect(g1.build().swing).toBe(0.55);  // g1 unchanged
        expect(g2.build().swing).toBe(0.66);  // g2 changed
    });

    test('.build() returns frozen object', () => {
        const groove = new GrooveBuilder().swing(0).build();
        expect(() => { (groove as any).swing = 0.7; }).toThrow();
    });

    test('Validation: swing out of range', () => {
        expect(() => new GrooveBuilder(1.5, 4)).toThrow('Swing must be 0-1');
        expect(() => new GrooveBuilder().swing(1.5)).toThrow('Swing must be 0-1');
    });

    test('Validation: steps < 1', () => {
        expect(() => new GrooveBuilder(0.5, 0)).toThrow('Steps must be >= 1');
        expect(() => new GrooveBuilder().steps(0)).toThrow('Steps must be >= 1');
    });

    test('Fluent chaining', () => {
        const groove = new GrooveBuilder()
            .swing(0.55)
            .steps(16)
            .build();
        expect(groove.swing).toBe(0.55);
        expect(groove.steps).toBe(16);
    });
});
```

**Summary of Changes**:
- **Remove**: 1 test (immutability test for `.swing()`)
- **Modify**: 2 tests (add validation for `.swing()` and `.steps()`)
- **Add**: 2 new tests (mutability tests, clone test)

**Net**: 8 tests total (was 6, +2 new)

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- GrooveBuilder.test.ts
```

Expected: All 8 tests pass.

### TypeScript Compilation

```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npx tsc --noEmit
```

Expected: No type errors.

### Integration Test (Existing Usage)

Verify existing groove integration tests still pass:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- groove-integration.test.ts
```

Expected: All 6 tests from Phase 8 Task 2 still pass.

---

## Zero-Allocation Compliance

**Before** (RFC-045-04 Violation):
```typescript
const groove = Clip.groove()
    .swing(0.55)   // ❌ Allocates new instance
    .steps(4)      // ❌ Allocates new instance
    .build();
```

**After** (RFC-045-04 Compliant):
```typescript
const groove = Clip.groove()
    .swing(0.55)   // ✅ Mutates in place
    .steps(4)      // ✅ Mutates in place
    .build();      // ✅ Only 1 allocation (frozen result)
```

**Allocations**: Reduced from 3 to 1 (67% reduction).

---

## Backward Compatibility Impact

### Breaking Change

**API change**: `.swing()` and `.steps()` now mutate instead of returning new instances.

**Impact**: Code relying on immutability will break:
```typescript
// Old code (immutable pattern)
const base = Clip.groove().swing(0.5);
const variant1 = base.swing(0.55);  // base unchanged
const variant2 = base.swing(0.66);  // base unchanged

// New behavior (mutable pattern)
const base = Clip.groove().swing(0.5);
const variant1 = base.swing(0.55);  // base IS CHANGED (same instance)
const variant2 = base.swing(0.66);  // variant1 IS CHANGED (same instance)

// Migration: Use clone()
const base = Clip.groove().swing(0.5);
const variant1 = base.clone().swing(0.55);  // base unchanged
const variant2 = base.clone().swing(0.66);  // variants independent
```

**Mitigation**: `clone()` provides explicit branching for users who need independent copies.

---

## Concerns / Questions

**None** - This is a necessary refactoring to achieve RFC-045-04 compliance. The breaking change is acceptable as GrooveBuilder is a new Phase 8 API.

---

**Awaiting Architect approval to proceed with implementation.**
