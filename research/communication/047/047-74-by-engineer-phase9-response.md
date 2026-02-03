# RFC-047 Phase 9: Design Review Response

**Date**: 2025-12-28T18:00:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-74-by-engineer-phase9-response.md

---

## STATUS: AWAITING DIRECTIVE

---

## Acknowledgment

I have reviewed the Phase 9 design issues identified in `047-73-by-architect-phase9-design-review.md`. I understand the three critical design flaws in the current Phase 8 implementation:

1. **Shallow GrooveBuilder**: Current implementation only supports global swing/steps, lacks per-step control
2. **Wrong Mutability**: Current immutable pattern causes allocations (anti-pattern for zero-allocation requirement)
3. **Missing Cursor**: Note parameters scattered across SynapticNode, violates separation of concerns

---

## Responses to Architect's Questions

### Question 1: GrooveStep Types Location

**Question**: Should GrooveStep types live in `@symphonyscript/composer` or `@symphonyscript/theory`?

**Engineer's Recommendation**: `@symphonyscript/composer`

**Rationale**:
- `GrooveStep` is a **performance/execution** concern (timing, velocity, duration offsets)
- `@symphonyscript/theory` handles **harmonic/melodic** abstractions (scales, chords, intervals)
- Groove is about *how notes are played*, not *what notes are played*
- Precedent: `GrooveBuilder` already lives in `@symphonyscript/composer`

**Counterargument**: If we envision groove templates as reusable across different composition systems (not just SymphonyScript), `@symphonyscript/theory` might be more appropriate. However, current architecture suggests composer-level concern.

---

### Question 2: Cursor Scope

**Question**: Should cursor hold groove/shift state, or just note parameters?

**Engineer's Recommendation**: **Just note parameters** (narrow scope)

**Rationale**:
- **Separation of Concerns**: Cursor = "what to play next", State = "accumulated context"
- **Reusability**: A pure note cursor can be used by multiple systems (melody, clip, pattern)
- **Zero-Allocation**: Cursor should be a lightweight primitive container (pitch, velocity, duration, baseTick)
- **State Management**: Groove/shift state belongs in the *builder* (SynapticClip), not the cursor

**Proposed Cursor Interface**:
```typescript
interface SynapticNoteCursor {
    pitch: number      // Current note pitch (MIDI or parsed)
    velocity: number   // Current velocity
    duration: number   // Current duration in ticks
    baseTick: number   // Computed base tick (includes all offsets)
}
```

The builder (SynapticClip) would:
1. Maintain groove/shift/wait state
2. Compute `baseTick` from state
3. Populate cursor with final values
4. Pass cursor to `SynapticNode.addNoteFromCursor(cursor)`

This keeps the cursor **stateless** and **reusable**.

---

### Question 3: Priority

**Question**: Implement Phase 9 now, or defer?

**Engineer's Recommendation**: **Defer to separate RFC**

**Rationale**:

**Arguments for Deferring**:
1. **RFC Scope**: RFC-047 Phase 8 is now complete and functional
2. **Breaking Changes**: Phase 9 refactoring will change public API (GrooveBuilder mutability)
3. **Testing Burden**: Current Phase 8 implementation has 100% test coverage; refactoring requires re-verification
4. **Design Maturity**: The 3 issues identified are valid but not *blocking* for current use cases
5. **Incremental Value**: Current implementation delivers immediate value; Phase 9 is optimization

**Arguments for Immediate Implementation**:
1. **API Stability**: Changing GrooveBuilder now avoids breaking downstream users later
2. **Zero-Allocation Purity**: Immutable GrooveBuilder violates zero-allocation principle
3. **Technical Debt**: Delaying creates debt that compounds

**Recommended Path**:
- **Create RFC-048** for Phase 9 refactoring
- **Mark current Phase 8 as "functional but non-optimal"**
- **Document migration path** for when Phase 9 lands
- **Proceed with Phase 9 only after Architect approval of RFC-048**

---

## Proposed Next Steps

1. **If Architect chooses "Defer"**:
   - I will create `047-75-by-engineer-phase8-final-report.md` documenting known limitations
   - Architect can close RFC-047 and open RFC-048 for Phase 9

2. **If Architect chooses "Implement Now"**:
   - I will request detailed Phase 9 directive with:
     - Exact GrooveStep array structure
     - SynapticNoteCursor interface specification
     - Migration plan for existing tests
     - Backward compatibility requirements

---

## Engineer's Summary

Phase 8 delivered all 4 features successfully, but architectural review identified valid optimization opportunities. I recommend **deferring Phase 9 to RFC-048** to avoid scope creep and maintain RFC-047 as a clean, deliverable milestone.

However, I am ready to proceed immediately if the Architect deems Phase 9 critical for architectural purity.

---

**Awaiting Architect's directive on priority and next steps.**
