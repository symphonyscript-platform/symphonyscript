# 049-02: Plan REJECTION — RFC-049 Compliance Failures

**Author**: Principal Architect  
**Date**: 2025-12-28T20:14:19+04:00  
**Status**: **REJECTED**  
**Response To**: 049-01-by-engineer-initial-plan.md

---

## Verdict: REJECTED

The submitted plan is **REJECTED**. While it demonstrates an understanding of the RFC's goals, it contains critical defects that violate RFC-049 directives, introduces unnecessary complexity, and exhibits API drift from the specification. Every defect is catalogued below with mandatory corrections.

---

## CRITICAL DEFECTS

### DEFECT-001: API Drift — Missing `clip` and `bridge` Properties in Base Cursor

**RFC-049 § 4.1 states**:
> **State**: `clip`, `bridge`, `hasPending`, `baseTick`, `velocity`, `duration`, `muted`.

**Your Plan (Phase 1)**:
> Properties: `hasPending`, `baseTick`, `velocity`, `duration`, `muted`

**Omission**: You OMIT `clip` and `bridge` from the base cursor state. These are **mandatory** per the RFC. The cursor MUST hold references to both the parent clip and the bridge for:
1. Escape methods to return the correct clip reference
2. `flush()` to access the bridge for kernel insertion

**Required Fix**: Add `clip` and `bridge` to Phase 1 property list.

---

### DEFECT-002: Architectural Violation — "Typed Proxy Layer" Proposal

**Your Proposal (Q2, Option C)**:
> Create a proxy layer that narrows types at each method.

**REJECTED**. This is **scope creep and complexity bloat**. The RFC specifies:
- `SynapticMelody` maintains TWO cursor instances
- Relay methods return **the cursor instance directly**, not proxies
- Type narrowing is achieved via method return types, NOT proxy objects

A "proxy layer" introduces:
1. Additional object allocations (violates zero-allocation)
2. Unnecessary runtime indirection
3. Maintenance complexity

**Required Fix**: Use Option A (direct cursor references) with proper TypeScript return type annotations. Example:
```typescript
class SynapticMelody {
  note(pitch: string, duration?: number): SynapticMelodyNoteCursor {
    this.commitPending();
    return this.noteCursor.note(pitch, duration);
  }
  
  chord(symbol: string): SynapticChordCursor {
    this.commitPending();
    return this.chordCursor.chord(symbol);
  }
}
```

The return types **ARE the narrowing**. No proxy needed.

---

### DEFECT-003: Incomplete Test Strategy — No Direct Verification Commands

**Your Testing Strategy (§3)**:
> Unit Tests (Jest), Location: `packages/composer/src/new/__tests__/`

**INSUFFICIENT**. Your plan:
1. Does not specify how tests will be RUN
2. Does not reference existing test configurations
3. Does not verify the test runner works with the `new/` directory structure

**Required Fix**: Specify:
```bash
npx nx test composer --testPathPattern="src/new/"
```

Also, BEFORE implementing, VERIFY that this path pattern works with the existing Jest configuration. If `src/new/` is not in the Jest `roots` or `testMatch`, you must update `jest.config.ts`.

---

### DEFECT-004: API Drift — Incorrect Relay Return Types

**RFC-049 § 4.4 states**:
> **Relays**:
>   - `note()`: returns `SynapticMelodyNoteCursor`
>   - `chord()`: returns `SynapticChordCursor`
>   - `degree()`: returns `SynapticMelodyNoteCursor`

**Your Plan (Phase 4)**:
> - `note()`: returns `SynapticMelodyNoteCursor` (self) ✓
> - `chord()`: **problem** - returns `SynapticChordCursor` (different type)

You flag this as a "problem" but it is **NOT a problem**. The RFC explicitly states `chord()` returns a different cursor type. This is intentional design for type-safe chaining.

**Required Fix**: Remove the "problem" annotation. The RFC defines the behavior; implement it as specified.

---

### DEFECT-005: Missing Cursor Construction Details

**RFC-049 § 4.5 states**:
> **Configuration**: `maxVoices` (default 8, configurable).

**Your Plan (Phase 5)**:
> Configuration: `maxVoices` (constructor parameter, default 8)

**Incomplete**. You do not specify WHO configures `maxVoices`:
1. Is it passed from `SynapticMelody` constructor?
2. Is it a global configuration?
3. Can it be changed after construction?

**Required Fix**: Specify the configuration flow:
```typescript
class SynapticMelody extends SynapticClip {
  private chordCursor: SynapticChordCursor;
  
  constructor(bridge: SiliconBridge, options?: { maxVoices?: number }) {
    super(bridge);
    this.chordCursor = new SynapticChordCursor(this, bridge, options?.maxVoices ?? 8);
  }
}
```

---

### DEFECT-006: Flawed GrooveBuilder Pre-allocation Strategy

**Your Proposal (Q3)**:
> `steps[]` pre-allocated to reasonable size (e.g., 64 steps max)

**Partially Acceptable**, but your "Option B" recommendation is flawed:
> Option B. Reasonable default (64), allow override for complex patterns.

This implies **constructor configuration**, which is fine. But you ALSO state:
> No dynamic array growth

**Contradiction**: If a user configures `maxSteps: 128`, you must pre-allocate 128 slots. But what happens if they call `.step()` 129 times? You do not specify error handling.

**Required Fix**: Specify explicit behavior:
```typescript
step(timing?: number): GrooveStepCursor {
  if (this.currentStep >= this.maxSteps) {
    throw new Error(`GrooveBuilder: maximum ${this.maxSteps} steps exceeded`);
  }
  // ...
}
```

---

### DEFECT-007: Missing Error Handling Throughout

Your plan contains **ZERO error handling specifications**. Real-world scenarios:

1. **Invalid pitch strings**: What happens when `note('Z9')` is called?
2. **Invalid chord symbols**: What happens when `chord('Xmaj42')` is called?
3. **Overflow conditions**: What happens when `maxVoices` is exceeded by a complex chord?
4. **Double commit**: What happens when `commit()` is called with no pending note?

**Required Fix**: Add error handling specifications for each phase. At minimum:
- Invalid input → `throw` with descriptive message
- Overflow → clamp/truncate with optional warning
- Double commit → no-op (safe)

---

### DEFECT-008: Vague Zero-Allocation Validation

**Your Plan (§3/Zero-Allocation Validation)**:
> Manual profiling with Chrome DevTools heap snapshots

**UNACCEPTABLE as primary validation**. Manual profiling is:
1. Non-deterministic
2. Not reproducible in CI
3. Dependent on human interpretation

**Required Fix**: Add automated validation:
```typescript
// In test file
test('flush() allocates zero objects', () => {
  const cursor = new SynapticChordCursor(mockClip, mockBridge, 8);
  cursor.chord('Cmaj7');
  
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) {
    cursor.flush();
    cursor.chord('Cmaj7');
  }
  const after = process.memoryUsage().heapUsed;
  
  // Allow for minimal variance (< 1KB for 10K iterations)
  expect(after - before).toBeLessThan(1024);
});
```

This is a **smoke test**, not a guarantee, but it catches gross allocation regressions.

---

## MINOR DEFECTS

### DEFECT-009: Inconsistent Inheritance Chain

**RFC-049 § 4.2 states**:
> `SynapticNoteCursor` Extends `SynapticCursor`.

**Your Plan** correctly identifies this.

**However**, RFC-049 § 4.4 states:
> `SynapticMelodyNoteCursor` Extends `SynapticMelodyBaseCursor`.

Your plan has `SynapticMelodyBaseCursor` extending `SynapticCursor`, and `SynapticMelodyNoteCursor` extending `SynapticMelodyBaseCursor`. This creates **parallel inheritance**:

```
SynapticCursor (Base)
├── SynapticNoteCursor (Basic notes)
├── SynapticMelodyBaseCursor (Expression support)
│   ├── SynapticMelodyNoteCursor (Melodic notes)
│   └── SynapticChordCursor (Chords)
└── SynapticDrumHitCursor (Drums)
```

**Question**: Is `SynapticNoteCursor` used AT ALL in the final architecture? It appears to be a stepping stone for `SynapticMelodyNoteCursor` but is never integrated into clip builders.

**Required Clarification**: Either:
- A) Remove `SynapticNoteCursor` if it's unused
- B) Explain its integration point (which builder uses it?)

---

### DEFECT-010: Timeline Estimation Without Contingency

**Your Timeline (§7)**:
> Total: ~14 hours of focused implementation

**No contingency buffer**. Given the complexity of zero-allocation constraints and the likelihood of subtle bugs:

**Required Fix**: Add 30% contingency:
> Total: ~18 hours (14 base + 4 contingency)

### DEFECT-11: Lifecycle Ambiguity
**Location**: `SynapticMelody.ts` section
**Defect**: "Instantiates `SynapticMelodyNoteCursor` and `SynapticChordCursor`".
**Requirement**: You must explicitly specify that these are **SINGLETON** instances created **ONCE** at construction time. The current wording allows for lazy instantiation or per-measure recreation, which is a violation of RFC-049 Section 3.2 ("maintains **one** instance").
**Fix**: Explicitly define the constructor logic to allocate these cursors exactly once and assign them to `readonly` properties.

### DEFECT-12: API Signature Drift
**Location**: `SynapticNoteCursor.ts` section
**Defect**: "Should support `note(pitch)` relay."
**Requirement**: RFC-049 Section 4.2 defines the signature as `note(pitch, duration?)`.
**Fix**: Match the RFC signature exactly in the plan. Precision is not optional.

### DEFECT-13: Insufficient Verification Strategy
**Location**: Verification Plan / `ZeroAllocation.test.ts`
**Defect**: "Manual Inspection / Logic Check".
**Requirement**: "Manual inspection" is prone to human error. You are replacing the entire audio composition layer.
**Fix**: Require a **Heap Allocation Test**:
1.  Run a loop of 10,000 note insertions.
2.  Measure memory usage before and after.
3.  Fail if `delta > 0` (allowing for GC noise, but strictly monitoring for linear growth).
    Alternatively, use a strictly configured linter rule set for `src/new` that bans `new` keywords in methods other than constructors.

### DEFECT-14: Weak Language on Forbidden Patterns
**Location**: User Review Required
**Defect**: "Avoids functional patterns...".
**Requirement**: Explicitly **BAN** `Array.prototype.forEach`, `map`, `filter`, and closures in `flush()` methods.
**Fix**: State clearly that usage of these methods in cursors will result in immediate code review rejection.

## Instructions
Resubmit the plan (049-03) addressing strict compliance with the above defects. Do not write code until the plan is **STRONGLY APPROVED**.


---

## ARCHITECTURAL DECISIONS (GRANTED)

### Q1: Note/Chord Cursor Switching
**Decision**: Option A APPROVED. Two cursor instances is acceptable.

### Q2: Cursor Type Exposure
**Decision**: Option A (direct cursor references) MANDATED. No proxy layer.

### Q3: GrooveBuilder Step Array Size
**Decision**: Option B APPROVED with mandatory error handling for overflow.

---

## REQUIRED REVISIONS

Before proceeding to implementation, submit a revised plan (`049-03`) addressing:

1. [ ] Add `clip` and `bridge` to Phase 1 base cursor state
2. [ ] Remove "typed proxy layer" proposal; use direct cursor references
3. [ ] Specify exact test command and verify Jest configuration
4. [ ] Remove "problem" annotation from `chord()` return type
5. [ ] Specify `maxVoices` configuration flow
6. [ ] Add overflow error handling for GrooveBuilder
7. [ ] Add error handling specifications for all phases
8. [ ] Add automated zero-allocation smoke test specification
9. [ ] Clarify `SynapticNoteCursor` usage or remove it
10. [ ] Add timeline contingency

---

## STATUS: AWAITING REVISED PLAN

The Engineer is BLOCKED until revised plan `049-03` is submitted and approved.

No implementation work is authorized until this review cycle completes.

---

**Architect Status**: Awaiting Engineer response with corrections.
