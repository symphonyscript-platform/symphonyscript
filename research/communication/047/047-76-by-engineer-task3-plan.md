# RFC-047 Phase 9 Task 3: SynapticNoteCursor - Implementation Plan

**Date**: 2025-12-28T18:03:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-76-by-engineer-task3-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Create `SynapticNoteCursor` class as a zero-allocation, reusable note parameter container to replace primitive parameters in `SynapticNode.addNote()`. This is Phase 9 Task 3 (no dependencies).

---

## Current State Analysis

### SynapticNode.addNote() Signature (lines 64-70)

```typescript
addNote(
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    muted?: boolean
): void
```

**Issues**:
- 5 primitive parameters (verbose, error-prone)
- No reusable parameter object
- Scattered state management

### Current State Fields in SynapticNode (lines 21-24)

```typescript
private entryId: number | undefined
private exitId: number | undefined
private expressionId: number = 0
private cycle: number = Infinity
```

**Observation**: `expressionId` is set via `setExpressionId()` and passed to `insertAsync()` (line 84), but not part of `addNote()` parameters.

---

## Proposed Changes

### File: `packages/synaptic/src/SynapticNoteCursor.ts` (NEW)

**Create cursor class**:

```typescript
/**
 * SynapticNoteCursor - Reusable note parameter container.
 * 
 * Zero-allocation pattern: instantiate once, reuse via set() method.
 * Holds all note parameters for passing to SynapticNode.addNote().
 * 
 * RFC-047 Phase 9 Task 3: Note builder cursor abstraction.
 */
export class SynapticNoteCursor {
    /** MIDI pitch (0-127) */
    pitch: number = 60
    
    /** MIDI velocity (0-127) */
    velocity: number = 100
    
    /** Duration in ticks */
    duration: number = 480
    
    /** Base tick position (after all offsets applied) */
    baseTick: number = 0
    
    /** Mute state */
    muted: boolean = false
    
    /**
     * Set all note parameters at once.
     * 
     * @param pitch - MIDI pitch (0-127)
     * @param velocity - MIDI velocity (0-127)
     * @param duration - Duration in ticks
     * @param baseTick - Start tick position
     * @param muted - Mute state (default: false)

     * @returns this for fluent chaining
     */
    set(
        pitch: number,
        velocity: number,
        duration: number,
        baseTick: number,
        muted: boolean = false
    ): this {
        this.pitch = pitch
        this.velocity = velocity
        this.duration = duration
        this.baseTick = baseTick
        this.muted = muted
        return this
    }
    
    /**
     * Reset cursor to default values.
     * 
     * @returns this for fluent chaining
     */
    reset(): this {
        this.pitch = 60
        this.velocity = 100
        this.duration = 480
        this.baseTick = 0
        this.muted = false
        return this
    }
}
```

---

### File: `packages/synaptic/src/index.ts`

**Add export**:

```typescript
// Existing exports
export { SynapticNode } from './SynapticNode'
export { SynapticCursor } from './SynapticCursor'
export { VoiceAllocator } from './VoiceAllocator'

// NEW: RFC-047 Phase 9 Task 3
export { SynapticNoteCursor } from './SynapticNoteCursor'
```

---

## Design Decisions

### 1. Cursor Scope: Just Note Parameters

Per Architect approval, cursor holds **only note parameters**, not state like groove/shift:
- ✅ `pitch`, `velocity`, `duration`, `baseTick`, `muted`
- ❌ No groove state
- ❌ No shift state
- ❌ No expression ID (managed by SynapticNode)

**Rationale**: Cursor is stateless and reusable. State management remains in builder classes.

### 2. Public Fields vs Getters/Setters

**Decision**: Use **public fields** for direct access.

**Rationale**:
- Zero-allocation: no method calls
- Simple read/write semantics
- Matches design review example (line 102-106)

### 3. `expressionId` Placement

**Decision**: `expressionId` **NOT** included in cursor.

**Rationale**:
- Expression ID is clip-level state (managed by SynapticNode)
- Not a per-note parameter (set once via `setExpressionId()`)
- Cursor represents "parameters for this specific note"

---

## Tests to Add

### File: `packages/synaptic/src/__tests__/SynapticNoteCursor.test.ts` (NEW)

```typescript
import { SynapticNoteCursor } from '../SynapticNoteCursor';

describe('SynapticNoteCursor', () => {
    test('Default values', () => {
        const cursor = new SynapticNoteCursor();
        expect(cursor.pitch).toBe(60);
        expect(cursor.velocity).toBe(100);
        expect(cursor.duration).toBe(480);
        expect(cursor.baseTick).toBe(0);
        expect(cursor.muted).toBe(false);
    });

    test('.set() updates all fields', () => {
        const cursor = new SynapticNoteCursor();
        cursor.set(72, 110, 240, 960, true);
        
        expect(cursor.pitch).toBe(72);
        expect(cursor.velocity).toBe(110);
        expect(cursor.duration).toBe(240);
        expect(cursor.baseTick).toBe(960);
        expect(cursor.muted).toBe(true);
    });

    test('.set() returns this for chaining', () => {
        const cursor = new SynapticNoteCursor();
        const result = cursor.set(60, 100, 480, 0);
        expect(result).toBe(cursor);
    });

    test('.reset() restores default values', () => {
        const cursor = new SynapticNoteCursor();
        cursor.set(72, 110, 240, 960, true);
        cursor.reset();
        
        expect(cursor.pitch).toBe(60);
        expect(cursor.velocity).toBe(100);
        expect(cursor.duration).toBe(480);
        expect(cursor.baseTick).toBe(0);
        expect(cursor.muted).toBe(false);
    });

    test('.reset() returns this for chaining', () => {
        const cursor = new SynapticNoteCursor();
        const result = cursor.reset();
        expect(result).toBe(cursor);
    });

    test('Reusable instance (zero-allocation pattern)', () => {
        const cursor = new SynapticNoteCursor();
        
        // First note
        cursor.set(60, 100, 480, 0);
        expect(cursor.pitch).toBe(60);
        
        // Reuse for second note
        cursor.set(64, 110, 240, 480);
        expect(cursor.pitch).toBe(64);
        expect(cursor.baseTick).toBe(480);
    });
});
```

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic
npm run test -- SynapticNoteCursor.test.ts
```

Expected: All 6 tests pass.

### TypeScript Compilation

```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic
npx tsc --noEmit
```

Expected: No type errors.

---

## Zero-Allocation Compliance

- ✅ Single instance created, reused via `.set()`
- ✅ Public fields (no getter/setter allocations)
- ✅ Primitive types only
- ✅ No arrays or objects
- ✅ `.set()` and `.reset()` return `this` (no new instances)

---

## Dependencies

**None** - Task 3 has no dependencies. Can be implemented immediately.

**Downstream**: Task 4 (Refactor SynapticNode) will consume this cursor.

---

## Concerns / Questions

**None** - This is a straightforward data structure with clear requirements from design review.

---

**Awaiting Architect approval to proceed with implementation.**
