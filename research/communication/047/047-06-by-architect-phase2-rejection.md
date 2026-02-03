# RFC-047 Phase 2: ARCHITECT REJECTION ❌

**Date**: 2025-12-24T22:11:00+04:00  
**Reviewer**: Architect (Zero-Trust Policy)  
**Status**: **REJECTED**
**Severity**: **CRITICAL**

---

## Executive Summary

The Phase 2 Micro-Plan contains **FUNDAMENTAL architectural misunderstandings** that violate RFC-047's core polyphony model. The proposed `.stack()` implementation would create SEQUENTIAL execution instead of PARALLEL voices, completely defeating the purpose of the Stack Graph architecture.

---

## Critical Violations

### 🔴 VIOLATION #1: `.stack()` Implementation is Architecturally Wrong

**Location**: Lines 145-157

**Proposed Code**:
```typescript
stack(voiceBuilder: (voice: SynapticClip) =\u003e void): this {
  const voiceClip = new SynapticClip(this['bridge']);
  voiceBuilder(voiceClip);
  voiceClip.play(this);  // ❌ THIS IS WRONG
  return this;
}
```

**Problem**: This creates **SEQUENTIAL** execution, not **PARALLEL** polyphony.

**Analysis**:
When you call `voiceClip.play(this)`, you are saying "play voiceClip, THEN play this clip". This creates:
```
Main Voice -> Voice 1 -> WAIT -> Main Voice continues
```

**What RFC-047 Requires** (Section 3.2):
```
          /-> Voice 1 ->\
Main Voice               -> Main Voice continues
          \-> Voice 2 -/
```

**The Correct Implementation**:
```typescript
stack(voiceBuilder: (voice: SynapticClip) => void): this {
  const startTick = this.currentTick;  // Capture current position
  
  // Create new clip that runs IN PARALLEL
  const voiceClip = new SynapticClip(this['bridge']);
  voiceClip.currentTick = startTick;  // Start at SAME time
  
  voiceBuilder(voiceClip);
  
  // DO NOT link voice.play(this) - that's sequential
  // Voice runs independently at the same time
  
  return this;
}
```

**Why This Matters**: The entire purpose of `.stack()` is to enable COUNTERPOINT (independent melodies at the same time). The proposed implementation would make it impossible to have two notes playing simultaneously.

---

### 🔴 VIOLATION #2: Missing `.voice()` Method

**Location**: Not implemented

**RFC-047 Requirement** (Brainstorming Session, confirmed in final RFC):
```typescript
clip.stack(s => s
  .voice(1, v => v.note('C'))   // MPE Channel 1
  .voice(2, v => v.note('E'))   // MPE Channel 2
)
```

**Problem**: The plan does NOT include `.voice(id)` for MPE routing.

**Required Addition**:
```typescript
voice(expressionId: number, builderFn: (v: SynapticClip) => void): this {
  // Execute builder, tag all notes with expressionId
  // This is for MPE channel assignment
}
```

---

### 🔴 VIOLATION #3: `.shift()` Modifies Wrong Abstraction

**Location**: Lines 185-214

**Problem**: The plan proposes modifying `SynapticClip.note()` to consume `microTimingOffset`.

**Why This Is Wrong**:
1. **Violates Single Responsibility**: `note()` should not know about timing offsets
2. **State Management**: Introduces mutable state (`microTimingOffset`) that can cause bugs
3. **Existing Cursor Pattern**: The current architecture already has `this.currentTick`

**The Correct Approach**:
`.shift()` should simply modify `this.currentTick` temporarily:
```typescript
shift(ticks: number): this {
  this.currentTick += ticks;  // Simple, direct
  return this;
}
```

**But Wait**: This changes cursor position. The RFC wants micro-timing WITHOUT cursor advancement.

**Solution**: We need a `pendingShift` that's applied once:
```typescript
private pendingShift: number = 0;

shift(ticks: number): this {
  this.pendingShift = ticks;
  return this;
}

note(pitch, duration, velocity): this {
  const actualTick = this.currentTick + this.pendingShift;
  this.builder.addNote(pitch, velocity, duration, actualTick);
  this.currentTick += duration;  // Cursor advances by duration
  this.pendingShift = 0;  // Reset
  return this;
}
```

**This is similar to the Engineer's approach BUT**:
- The issue is that `addNote()` in `SynapticNode` does NOT accept a `startTick` parameter
- This requires modifying the `SynapticNode` API (which was locked in Phase 1)

**Architect's Concern**: This violates Phase boundaries. We need to clarify if `SynapticNode.addNote()` will be extended or if micro-timing is handled at a higher level.

---

### 🟡 VIOLATION #4: `GrooveBuilder` is Over-Engineered

**Location**: Lines 66-106

**Problem**: The immutability pattern is correct, BUT the implementation is wasteful.

**Current Approach** (Lines 78-80):
```typescript
swing(amount: number): this {
  const next = new GrooveBuilder();  // ❌ Allocates new object
  next.swingAmount = amount;
  next.stepCount = this.stepCount;  // Manual copying
  return next;
}
```

**Better Approach** (Zero Allocation):
```typescript
class GrooveBuilder {
  constructor(
    private readonly swingAmount: number = 0.5,
    private readonly stepCount: number = 4
  ) {}
  
  swing(amount: number): GrooveBuilder {
    return new GrooveBuilder(amount, this.stepCount);
  }
  
  steps(count: number): GrooveBuilder {
    return new GrooveBuilder(this.swingAmount, count);
  }
}
```

**Why**: Uses constructor parameters instead of manual property copying. Cleaner and safer.

---

## Compliance Matrix

| Requirement | Status | Issue |
|------------|--------|-------|
| Fluent Groove DSL | ⚠️ CONDITIONAL | Over-engineered but functional |
| `.stack()` Polyphony | ❌ FAIL | Creates sequential, not parallel |
| `.voice()` MPE | ❌ FAIL | Not implemented |
| `.shift()` Micro-Timing | ⚠️ CONDITIONAL | Correct concept, wrong abstraction |
| Semantic Timing | ⚠️ CONDITIONAL | Needs SynapticNode API clarification |

---

## Required Corrections

### CRITICAL:

1. **Redesign `.stack()`**: Must create PARALLEL voices, not sequential chains
   - Do NOT use `voiceClip.play(this)`
   - Voices run at same `startTick`
   - Requires understanding of SynapticNode graph topology

2. **Implement `.voice()`**: Required for MPE routing per RFC-047
   - Signature: `.voice(id: number, builderFn)`
   - Tags notes with `expressionId`

3. **Clarify `.shift()` Architecture**: 
   - Does `SynapticNode.addNote()` accept `startTick`?
   - If NO: How do we implement micro-timing?
   - If YES: Update the spec

### MINOR:

4. **Simplify `GrooveBuilder`**: Use constructor parameters instead of manual copying

---

## Architect's Recommendation

**BEFORE proceeding with Phase 2**:
1. Engineer must study the synaptic graph model (review `SynapticNode` API)
2. Architect must clarify: Can we extend `SynapticNode.addNote()` or is it locked?
3. Engineer must propose revised `.stack()` that creates true parallelism

**Alternative**: If the current `SynapticNode` cannot support parallel voices, we need to **AMEND RFC-047** to acknowledge this architectural constraint.

---

## Next Step

Engineer must **REVISE this plan** addressing:
- Correct `.stack()` implementation (parallel, not sequential)
- Add `.voice()` implementation
- Clarify micro-timing strategy with Architect

**NO IMPLEMENTATION** may begin until these issues are resolved.

---

**Architect Signature**: Zero-Trust Reviewer  
**Verdict**: **REJECTED** ❌  
**Phase 2**: BLOCKED
