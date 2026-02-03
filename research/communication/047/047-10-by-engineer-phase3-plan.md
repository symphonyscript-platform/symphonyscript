# MICRO-PLAN: RFC-047 Phase 3 - Kernel Polyphony

**Agent**: Senior TypeScript Systems Engineer  
**Supervisor**: Hostile Architect (Zero-Trust Policy)  
**RFC**: RFC-047 (24-Bit Theory & Polyphony Architecture)  
**Phase**: Phase 3 - Kernel Polyphony  
**Status**: AWAITING APPROVAL  
**Date**: 2025-12-24T23:12:00+04:00

---

## 1. GOAL

Implement Kernel-level polyphony features for `@symphonyscript/kernel` package per RFC-047 Phase 3:

1. **Phase-Locking Scheduler**: Implement `Time % LoopLength` synchronization model
2. **Voice Allocator**: Bitmask iteration for polyphonic playback
3. **MPE Integration**: Extend kernel to support MPE expression routing (optional - depends on Architect guidance)

**Result**: Kernel supports true polyphonic playback with phase-locked synchronization and can iterate bitwise harmony masks from Phase 1.

---

## 2. SCOPE CLARIFICATION REQUIRED

**Before proceeding**, I need Architect clarification on the following:

### Question 1: Phase 3 Scope Definition

RFC-047 Section 6 states Phase 3 involves:
1. **Scheduler**: Implement Phase-Locking
2. **Voice Allocator**: Bitmask iteration

However, the RFC does not provide detailed specifications for:
- Where the scheduler lives (new file? existing file?)
- Voice allocator API design
- Integration points with existing SiliconBridge/SiliconSynapse

**Request**: Does the Architect have more detailed requirements, or should I propose an architecture based on the existing kernel structure?

### Question 2: Integration with Phase 1 Theory

Phase 1 created `@symphonyscript/theory` with `HarmonyMask` type and `unpack()` function.

**Question**: Should Phase 3 kernel:
- A) Import from `@symphonyscript/theory` directly?
- B) Duplicate bitwise logic in kernel for zero-dependency?
- C) Defer harmony mask iteration to Phase 4 integration?

**Recommendation**: Option A (import from theory) - maintains single source of truth for bitwise operations.

### Question 3: MPE Extension Scope

Phase 2 implemented `.voice(expressionId)` in composer, but `SynapticNode.addNote()` doesn't yet accept expressionId.

**Question**: Should Phase 3 include:
- Extending `SynapticNode.addNote()` signature to accept `expressionId`?
- Kernel-level MPE routing logic?

**Or**: Defer MPE to Phase 4 (integration phase)?

**Recommendation**: Extend `addNote()` signature in Phase 3, defer routing logic to Phase 4.

---

## 3. PROPOSED ARCHITECTURE (Pending Approval)

### 3.1. Phase-Locking Scheduler

**Purpose**: Guarantee eventual synchronization via `tick % loopLength` calculation.

**Proposed Location**: Enhance existing `SiliconSynapse` or create new `PhaseLockedScheduler.ts`

**Implementation Sketch**:
```typescript
class PhaseLockedScheduler {
  private loopLength: number;
  
  /**
   * Calculate phase-locked playback position.
   * Per RFC-047 Section 5.1: "ignores history, calculates as Time % LoopLength"
   */
  getPlaybackTick(currentTime: number): number {
    return currentTime % this.loopLength;
  }
  
  /**
   * Check if event should fire at current phase position.
   */
  shouldTrigger(eventTick: number, currentTick: number, tolerance: number = 0): boolean {
    const phaseTick = this.getPlaybackTick(currentTick);
    const eventPhase = this.getPlaybackTick(eventTick);
    return Math.abs(phaseTick - eventPhase) <= tolerance;
  }
}
```

**Questions**:
- Should this be integrated into existing `SiliconSynapse.ts` or separate module?
- What's the loop length initialization strategy?

---

### 3.2. Voice Allocator (Bitmask Iteration)

**Purpose**: Iterate HarmonyMask bits and allocate voices for polyphonic playback.

**Proposed Location**: New file `VoiceAllocator.ts` or extend `SiliconBridge.ts`

**Implementation Sketch**:
```typescript
import { unpack, type HarmonyMask } from '@symphonyscript/theory';

class VoiceAllocator {
  /**
   * Allocate voices for a harmony mask.
   * Uses zero-allocation unpack() from Phase 1.
   */
  allocateVoices(
    mask: HarmonyMask,
    rootPitch: number,
    velocity: number,
    duration: number,
    baseTick: number
  ): void {
    unpack(mask, (interval) => {
      const pitch = rootPitch + (interval / 2);  // Convert 24-EDO to semitones
      this.addVoice(pitch, velocity, duration, baseTick);
    });
  }
  
  private addVoice(pitch: number, velocity: number, duration: number, tick: number): void {
    // Implementation depends on existing kernel architecture
    // Likely calls SiliconBridge.insertAsync or similar
  }
}
```

**Questions**:
- How does this integrate with `SiliconBridge`?
- Should voice allocation happen in composer layer or kernel layer?
- What's the API surface that composer calls?

---

### 3.3. MPE Extension (Optional)

**Proposed Change**: Extend `SynapticNode.addNote()` signature.

**Current Signature**:
```typescript
addNote(
  pitch: number,
  velocity: number,
  duration: number,
  baseTick: number,
  muted?: boolean
): void
```

**Proposed Signature**:
```typescript
addNote(
  pitch: number,
  velocity: number,
  duration: number,
  baseTick: number,
  muted?: boolean,
  expressionId?: number  // NEW: MPE routing ID
): void
```

**Implementation**:
- Store `expressionId` in note metadata
- Pass through to `SiliconBridge.insertAsync()`
- Kernel consumer can use for MPE channel assignment

**Backward Compatibility**: ✅ Optional parameter maintains compatibility

---

## 4. FILE INVENTORY (Tentative - Pending Clarification)

### Files to CREATE:

```
packages/kernel/src/
├── PhaseLockedScheduler.ts  [NEW] - Phase-locking logic (if separate)
└── VoiceAllocator.ts        [NEW] - Bitmask iteration (if separate)
```

**OR** (if integrated):
- No new files, extend existing `SiliconSynapse.ts` or `SiliconBridge.ts`

### Files to MODIFY:

```
packages/synaptic/src/
└── SynapticNode.ts          [MODIFY] - Add expressionId parameter to addNote()

packages/kernel/src/
├── silicon-bridge.ts        [MODIFY] - Support expressionId in insertAsync()
└── [integration file TBD]   [MODIFY] - Integrate scheduler/allocator
```

---

## 5. BLOCKING QUESTIONS FOR ARCHITECT

**I cannot proceed with implementation until the Architect provides**:

1. **Architecture Decision**: Should Phase 3 features be:
   - A) New standalone modules (PhaseLockedScheduler.ts, VoiceAllocator.ts)
   - B) Integrated into existing SiliconSynapse/SiliconBridge
   - C) Hybrid approach (specify which goes where)

2. **Theory Integration**: Confirm approach for using `@symphonyscript/theory`:
   - Import HarmonyMask and unpack() directly? (Recommended)
   - Or duplicate bitwise logic?

3. **MPE Scope**: Should Phase 3 include:
   - Just signature extension (expressionId parameter)?
   - Full MPE routing implementation?
   - Defer to Phase 4?

4. **API Design**: What should the composer-facing API look like?
   ```typescript
   // Option A: Explicit harmony API
   clip.harmony(mask, rootPitch, duration);
   
   // Option B: Integrated with existing note API
   clip.note('C4', 480).applyHarmony(mask);
   
   // Option C: Something else?
   ```

5. **Loop Length**: How is loop length configured?
   - Global setting?
   - Per-clip?
   - Per-session?

---

## 6. PROPOSED NEXT STEPS

**Once Architect provides clarification**:

1. Create detailed implementation plan with exact files and line-by-line changes
2. Define test strategy (unit tests for scheduler, allocator, MPE)
3. Submit revised micro-plan for approval
4. Execute implementation
5. Verify with integration tests
6. Submit walkthrough

**Estimated Implementation Time** (after approval): 2-3 hours  
**Estimated Test Count**: 10-15 tests

---

## 7. AWAITING ARCHITECT GUIDANCE

**Status**: 🟡 **BLOCKED - Awaiting Architectural Decisions**

I have completed Phases 1 and 2 with strong approval. Phase 3 requires more detailed architectural guidance before I can create a precise implementation plan.

**Request**: Architect, please provide:
1. Detailed Phase 3 requirements document, OR
2. Answers to the 5 blocking questions above, OR
3. A working session to co-design the Phase 3 architecture

---

**Engineer Signature**: Senior TypeScript Systems Engineer  
**Timestamp**: 2025-12-24T23:12:00+04:00  
**Phase**: 3 - Kernel Polyphony (PLANNING - Awaiting Guidance)
