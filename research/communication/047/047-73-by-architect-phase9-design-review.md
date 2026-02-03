# RFC-047 Phase 9: ARCHITECT DESIGN REVIEW

**Date**: 2025-12-28T17:56:00+04:00  
**From**: The Architect  
**To**: Stakeholder / Engineer  
**RFC**: 047  
**Document**: 047-73-by-architect-phase9-design-review.md

---

## STATUS: DESIGN REVIEW REQUIRED

Three architectural issues have been identified with Phase 8 implementation. This document proposes Phase 9 to address them.

---

## Issue Analysis

### Issue 1: Shallow GrooveBuilder

**Current State** (`packages/composer/src/GrooveBuilder.ts`):
```typescript
class GrooveBuilder {
    constructor(swingAmount = 0.5, stepCount = 4) {}
    swing(amount): GrooveBuilder  // Returns NEW instance
    steps(count): GrooveBuilder   // Returns NEW instance
    build(): { swing, steps }     // No step array!
}
```

**Legacy Pattern** (`packages/theory/src/legacy/groove/types.ts`):
```typescript
interface GrooveStep {
    timing?: number   // Offset ratio (0.1 = 10% late)
    velocity?: number // Velocity multiplier (1.1 = accent)
    duration?: number // Duration multiplier (0.5 = staccato)
}

interface GrooveTemplate {
    name: string
    stepsPerBeat: number
    steps: GrooveStep[]  // Per-step customization!
}
```

**Problem**: Current GrooveBuilder cannot define per-step timing, velocity, or duration. It only supports global swing.

**Required**: Support `steps: GrooveStep[]` array with individual step customization.

---

### Issue 2: Wrong Immutability Pattern

**Current State**: GrooveBuilder is immutable (returns new instance on each method call).

**Required**: GrooveBuilder should be **mutable** with a `clone()` method for branching.

**Rationale**:
- Immutable pattern allocates new objects on every method call
- Mutable-with-clone allows zero-allocation when building inline
- Clone provides explicit branching when needed

**Required API**:
```typescript
class GrooveBuilder {
    swing(amount: number): this      // Mutates, returns this
    steps(count: number): this       // Mutates, returns this
    step(index: number, config: Partial<GrooveStep>): this  // NEW
    clone(): GrooveBuilder           // Creates new instance
    build(): GrooveTemplate          // Returns frozen object
}
```

---

### Issue 3: Missing Note Cursor Abstraction

**Current State** (`packages/synaptic/src/SynapticNode.ts`):
```typescript
class SynapticNode {
    addNote(pitch, velocity, duration, baseTick, muted) {
        // Directly calls bridge.insertAsync
        // All logic inline
    }
}
```

**Existing Cursor** (`packages/synaptic/src/SynapticCursor.ts`):
- This is a **playback cursor** for audio thread
- Handles synaptic resolution, not note building

**Required**: A **note builder cursor** (similar to legacy pattern) that:
1. Is instantiated once and reused for each note
2. Holds note parameters (pitch, velocity, duration, tick)
3. Is passed to SynapticNode.addNote() instead of primitives
4. Enables zero-allocation by reusing the same cursor instance

**Proposed Pattern**:
```typescript
// SynapticNoteCursor - reusable note parameter holder
class SynapticNoteCursor {
    pitch: number = 60
    velocity: number = 100
    duration: number = 480
    baseTick: number = 0
    muted: boolean = false
    expressionId: number = 0
    
    set(pitch, velocity, duration, baseTick): this
    reset(): this
}

// Usage in SynapticNode
class SynapticNode {
    private cursor: SynapticNoteCursor  // Single instance, reused
    
    constructor(bridge) {
        this.cursor = new SynapticNoteCursor()  // One allocation
    }
    
    addNote(pitch, velocity, duration, baseTick) {
        this.cursor.set(pitch, velocity, duration, baseTick)
        // Pass cursor to bridge operation
    }
}
```

---

## Proposed Phase 9 Tasks

### Task 1: Refactor GrooveBuilder to Mutable Pattern

**Changes**:
- Remove immutable pattern (stop creating new instances)
- Methods mutate internal state and return `this`
- Add `clone()` for explicit branching
- Update tests

**Files**:
- `packages/composer/src/GrooveBuilder.ts`
- `packages/composer/src/__tests__/GrooveBuilder.test.ts`

---

### Task 2: Add GrooveStep Array Support

**Changes**:
- Add `private stepConfigs: GrooveStep[]` state
- Add `step(index: number, config: Partial<GrooveStep>): this` method
- Update `build()` to return full `GrooveTemplate`
- Update `SynapticClip.use()` to consume new format

**Files**:
- `packages/composer/src/GrooveBuilder.ts`
- `packages/composer/src/SynapticClip.ts`
- `packages/composer/src/__tests__/groove-integration.test.ts`

**Types Required**:
- Export `GrooveStep` and `GrooveTemplate` from composer (or theory)

---

### Task 3: Create SynapticNoteCursor

**Changes**:
- Create `packages/synaptic/src/SynapticNoteCursor.ts`
- Implement cursor with mutable fields and setter methods
- Ensure zero-allocation pattern (single instance reuse)

**Files**:
- `packages/synaptic/src/SynapticNoteCursor.ts` (NEW)
- `packages/synaptic/src/index.ts` (export)

---

### Task 4: Refactor SynapticNode to Use Cursor

**Changes**:
- Add private `cursor: SynapticNoteCursor` field (one instance)
- Refactor `addNote()` to populate and use cursor
- Maintain backward-compatible API (primitives → cursor internally)

**Files**:
- `packages/synaptic/src/SynapticNode.ts`
- `packages/synaptic/src/__tests__/SynapticNode.test.ts`

---

## Questions for Stakeholder

Before proceeding:

1. **GrooveStep Location**: Should `GrooveStep` and `GrooveTemplate` types live in `@symphonyscript/composer` or `@symphonyscript/theory`?

2. **Cursor Scope**: Should `SynapticNoteCursor` also hold groove/shift state, or just note parameters?

3. **Priority**: Should Phase 9 be implemented now, or deferred? This is a non-breaking refactor but affects API ergonomics.

---

## Awaiting Decision

**Stakeholder**: Please confirm direction before Phase 9 engineer directive is issued.
