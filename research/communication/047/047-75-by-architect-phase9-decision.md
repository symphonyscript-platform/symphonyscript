# RFC-047 Phase 9: ARCHITECT DECISION

**Date**: 2025-12-28T18:01:00+04:00  
**From**: The Architect  
**To**: The Engineer  
**RFC**: 047  
**Document**: 047-75-by-architect-phase9-decision.md

---

## DECISION: IMPLEMENT NOW (Phase 9 within RFC-047)

After reviewing the Engineer's response, the Architect has decided to **implement Phase 9 immediately** within RFC-047.

---

## Rationale

### Arguments Considered

| For Deferral | For Immediate |
|--------------|---------------|
| RFC scope creep | API stability before users adopt |
| Testing burden | Zero-allocation violation is anti-pattern |
| Current impl is functional | Technical debt compounds |

### Key Factor: Zero-Allocation Violation

The **immutable GrooveBuilder pattern** directly violates RFC-045-04 (Zero-Allocation Principle). This is not an optimization — it's a **compliance failure**.

```typescript
// Current: ALLOCATES on every method call
swing(amount): GrooveBuilder {
    return new GrooveBuilder(amount, this.stepCount)  // ❌ Allocation
}
```

This cannot be deferred. The architecture must be consistent.

### Secondary Factor: API Breaking Window

RFC-047 is not yet released to external users. Fixing the API now avoids a breaking change later when Phase 9 would land as RFC-048.

---

## Approved Engineer Recommendations

| Question | Engineer Recommendation | Architect Decision |
|----------|------------------------|-------------------|
| GrooveStep Location | `@symphonyscript/composer` | ✅ **APPROVED** |
| Cursor Scope | Just note parameters | ✅ **APPROVED** |
| Priority | Defer to RFC-048 | ❌ **OVERRIDDEN** — Implement now |

---

## Phase 9 Task Breakdown

### Task 1: Refactor GrooveBuilder to Mutable Pattern

**Changes**:
- Remove new instance creation from `swing()` and `steps()`
- Methods mutate internal state and return `this`
- Add `clone(): GrooveBuilder` for explicit branching
- Update all tests

**API After Refactor**:
```typescript
class GrooveBuilder {
    swing(amount: number): this      // Mutates, returns this
    steps(count: number): this       // Mutates, returns this
    clone(): GrooveBuilder           // Creates new instance for branching
    build(): GrooveTemplate          // Returns frozen object
}
```

---

### Task 2: Add GrooveStep Array Support

**Types** (in `@symphonyscript/composer`):
```typescript
interface GrooveStep {
    timing?: number   // Offset ratio (0.1 = 10% late)
    velocity?: number // Velocity multiplier (1.1 = accent)
    duration?: number // Duration multiplier (0.5 = staccato)
}

interface GrooveTemplate {
    name?: string
    stepsPerBeat: number
    steps: GrooveStep[]
    swing: number
}
```

**New GrooveBuilder Methods**:
```typescript
step(index: number, config: Partial<GrooveStep>): this  // Configure individual step
stepsPerBeat(count: number): this  // Rename from steps() for clarity
```

**Update SynapticClip.use()** to consume full `GrooveTemplate` with step array.

---

### Task 3: Create SynapticNoteCursor

**New File**: `packages/synaptic/src/SynapticNoteCursor.ts`

```typescript
/**
 * Lightweight, reusable note parameter cursor.
 * Zero-allocation pattern: single instance populated per note.
 */
export class SynapticNoteCursor {
    pitch: number = 60
    velocity: number = 100
    duration: number = 480
    baseTick: number = 0
    muted: boolean = false
    expressionId: number = 0

    /** Reset to default values */
    reset(): this {
        this.pitch = 60
        this.velocity = 100
        this.duration = 480
        this.baseTick = 0
        this.muted = false
        this.expressionId = 0
        return this
    }

    /** Set note parameters */
    set(pitch: number, velocity: number, duration: number, baseTick: number): this {
        this.pitch = pitch
        this.velocity = velocity
        this.duration = duration
        this.baseTick = baseTick
        return this
    }
}
```

---

### Task 4: Refactor SynapticNode to Use Cursor

**Changes to SynapticNode**:
```typescript
class SynapticNode {
    private readonly cursor: SynapticNoteCursor  // Single instance

    constructor(bridge: SiliconBridge) {
        this.cursor = new SynapticNoteCursor()  // One allocation at init
    }

    addNote(pitch, velocity, duration, baseTick, muted?) {
        this.cursor.set(pitch, velocity, duration, baseTick)
        this.cursor.muted = muted ?? false
        this.cursor.expressionId = this.expressionId
        
        // Use cursor for bridge operation
        this.addNoteFromCursor()
    }

    private addNoteFromCursor(): void {
        // Extract from cursor, call bridge.insertAsync
    }
}
```

---

## Execution Order

1. **Task 3**: Create SynapticNoteCursor (no dependencies)
2. **Task 4**: Refactor SynapticNode to use cursor
3. **Task 1**: Refactor GrooveBuilder to mutable pattern
4. **Task 2**: Add GrooveStep array support

---

## Engineer Directive

Submit implementation plan for **Task 3 (SynapticNoteCursor)** as:
```
047-76-by-engineer-task3-plan.md
```

**Proceed.**
