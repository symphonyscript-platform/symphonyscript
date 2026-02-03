# RFC-047 Phase 3: ARCHITECT GUIDANCE

**Date**: 2025-12-24T23:14:00+04:00  
**Reviewer**: Architect (Zero-Trust Policy)  
**Status**: **ARCHITECTURAL DIRECTIVE**

---

## Executive Summary

The Engineer has correctly identified that RFC-047 Section 6 provides only high-level Phase 3 goals. I am providing detailed architectural guidance for Phase 3 implementation.

**Verdict**: Phase 3 scope is **REDUCED** from original RFC intent. Full kernel polyphony is deferred to future phases. Phase 3 will ONLY extend the signature to support future integration.

---

## Answers to 5 Blocking Questions

### Question 1: Architecture Decision

**ANSWER**: **Option B - Integrated into Existing Modules**

**Rationale**:
- Phase-locked scheduler is TOO AMBITIOUS for current scope
- Voice allocator requires kernel redesign
- These features need separate RFC with performance benchmarks

**Directive**: Phase 3 scope is REDUCED to:
1. Extend `SynapticNode.addNote()` to accept `expressionId` parameter (MPE preparation)
2. Document phase-locking requirements for future implementation
3. NO new modules, NO scheduler implementation, NO voice allocator

---

### Question 2: Theory Integration

**ANSWER**: **Defer to Future Phase**

**Rationale**:
- HarmonyMask iteration requires kernel architectural changes
- Current kernel processes individual notes, not chord masks
- This needs separate RFC to design chord unpacking strategy

**Directive**: Phase 3 does NOT integrate with `@symphonyscript/theory`. HarmonyMask iteration is deferred to Phase 4 or later.

---

### Question 3: MPE Scope

**ANSWER**: **Signature Extension Only**

**Implementation Required**:
1. Extend `SynapticNode.addNote()` to accept optional `expressionId?: number`
2. Pass through to `SiliconBridge.insertAsync()` (add as 8th parameter)
3. Store in command ring (requires adding field to command structure)
4. NO routing logic in Phase 3

**Justification**: This maintains backward compatibility while enabling Phase 2 composer to pass expressionId down the stack.

---

### Question 4: API Design

**ANSWER**: **NO Composer API Changes**

**Rationale**:
- Composer already has `.voice(expressionId)` from Phase 2
- Current `.note()` API is sufficient
- HarmonyMask API is deferred with voice allocator

**Directive**: Phase 3 makes NO changes to `@symphonyscript/composer`. Only kernel and synaptic layers are modified.

---

### Question 5: Loop Length

**ANSWER**: **Out of Scope**

**Rationale**:
- Phase-locked scheduler is deferred
- Loop length configuration requires scheduler implementation
- This is future work

**Directive**: Phase 3 does NOT implement loop length or phase-locking. This is deferred to RFC-048 (Kernel Scheduler Redesign).

---

## Revised Phase 3 Scope

**GOAL**: Extend the system to support MPE expression routing (signature extension only).

**IN SCOPE**:
1. Modify `SynapticNode.addNote()` to accept `expressionId?: number`
2. Modify `SiliconBridge.insertAsync()` to accept `expressionId?: number`
3. Update command ring structure to store expressionId
4. Modify `SynapticClip.note()` to pass  through `this.currentExpressionId` to `addNote()`
5. Write tests verifying expressionId is passed through the stack

**OUT OF SCOPE** (Deferred to Future RFCs):
- Phase-locked scheduler
- Voice allocator (HarmonyMask iteration)
- Loop length configuration
- MPE routing logic
- New kernel modules

---

## Implementation Plan

### Files to MODIFY:

```
packages/synaptic/src/
└── SynapticNode.ts          [MODIFY] - Add expressionId parameter to addNote()

packages/composer/src/
└── SynapticClip.ts          [MODIFY] - Pass currentExpressionId to addNote()

packages/kernel/src/
└── silicon-bridge.ts        [MODIFY] - Add expressionId to insertAsync()

packages/kernel/src/
└── [command structure file] [MODIFY] - Store expressionId in command data
```

### Files to CREATE:

```
packages/synaptic/src/__tests__/
└── SynapticNode.mpe.test.ts [NEW] - Test expressionId parameter

packages/composer/src/__tests__/
└── mpe-integration.test.ts  [NEW] - Test end-to-end expressionId flow
```

---

## Expected Deliverables

1. ✅ `SynapticNode.addNote()` signature extended
2. ✅ `SiliconBridge.insertAsync()` signature extended
3. ✅ Command ring stores expressionId
4. ✅ `SynapticClip.note()` passes expressionId
5. ✅ 5+ tests verifying expressionId propagation
6. ✅ Walkthrough document

**Estimated Time**: 1-2 hours  
**Estimated Tests**: 5-8 tests

---

## Architectural Rationale

**Why Reduce Scope?**

1. **Phase-locked scheduler** requires:
   - Performance benchmarks
   - Concurrency model
 - Safe zone redesign
   - Separate RFC

2. **Voice allocator** requires:
   - Kernel redesign (chord vs note model)
   - Memory allocator for voice buffers
   - Polyphony limit logic
   - Separate RFC

3. **Current State**: Phases 1-2 focused on *data structures* and *composition*. Phase 3 should complete the *plumbing* for future integration, not implement full polyphony engine.

**Future Work**: RFC-048 will design kernel scheduler and voice allocator with proper benchmarks and concurrency model.

---

## Directive to Engineer

**STOP** designing phase-locked scheduler and voice allocator.

**START** implementing minimal MPE signature extension:
1. Read current `SiliconBridge.insertAsync()` signature
2. Add `expressionId?: number = 0` as 8th parameter
3. Update `SynapticNode.addNote()` to accept and pass expressionId
4. Update `SynapticClip.note()` to pass `this.currentExpressionId`
5. Verify expressionId flows through the stack via tests
6. Submit micro-plan for this reduced scope

**Phase 3 is NOT about building a polyphony engine. It's about completing the MPE data pipeline.**

---

**Architect Signature**: Zero-Trust Reviewer  
**Timestamp**: 2025-12-24T23:14:00+04:00  
**Directive**: Phase 3 scope REDUCED - Signature extension only
