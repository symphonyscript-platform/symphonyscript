# RFC-047 Phase 3: ARCHITECT GUIDANCE (REVISED)

**Date**: 2025-12-25T06:15:43+04:00  
**Reviewer**: Architect (Zero-Trust Policy)  
**Status**: **FULL ARCHITECTURAL DIRECTIVE**  
**Previous Guidance**: 047-11 RESCINDED by User

---

## ARCHITECT CORRECTION

Previous guidance (047-11) improperly reduced Phase 3 scope. RFC-047 Section 6 EXPLICITLY requires:

1. **Scheduler**: Implement Phase-Locking
2. **Voice Allocator**: Bitmask iteration

**This is NON-NEGOTIABLE.** Deferral is unacceptable.

---

## Answers to 5 Blocking Questions (FULL IMPLEMENTATION)

### Question 1: Architecture Decision

**ANSWER**: **Option C - Hybrid Approach**

**Structure**:
```
packages/kernel/src/
├── scheduler/
│   └── PhaseLockedScheduler.ts   [NEW] - Phase-lock timing logic
└── polyphony/
    └── VoiceAllocator.ts         [NEW] - Bitmask iteration + voice assignment

packages/synaptic/src/
└── SynapticNode.ts               [MODIFY] - Add expressionId parameter
```

**Rationale**:
- **Separation of Concerns**: Scheduler is timing, Allocator is voice management
- **Testability**: Standalone modules are easier to unit test
- **Future Extensibility**: Can replace scheduler without touching allocator

---

### Question 2: Theory Integration

**ANSWER**: **Option A - Import from @symphonyscript/theory**

**Directive**:
```typescript
// In VoiceAllocator.ts
import { unpack, type HarmonyMask, type Interval24EDO } from '@symphonyscript/theory';
```

**Rationale**:
- Single source of truth for bitwise operations
- `unpack()` is zero-allocation (verified in Phase 1)
- No code duplication

**Dependency**:
```json
// packages/kernel/package.json
{
  "dependencies": {
    "@symphonyscript/theory": "file:../theory"
  }
}
```

---

### Question 3: MPE Scope

**ANSWER**: **Full Signature Extension + Routing Foundation**

**Implementation**:
1. `SynapticNode.addNote()` → Add `expressionId?: number` (6th param)
2. `SiliconBridge.insertAsync()` → Add `expressionId: number` (9th param)
3. `VoiceAllocator` → Assign expressionIds to polyphonic voices

**Voice Allocation Strategy**:
```typescript
// VoiceAllocator assigns expressionId per voice
allocateVoices(mask: HarmonyMask, baseExpressionId: number): void {
  let voiceIndex = 0;
  unpack(mask, (interval) => {
    const expressionId = baseExpressionId + voiceIndex;  // Sequential IDs
    this.addVoice(interval, expressionId);
    voiceIndex++;
  });
}
```

**MPE Constraint**: Maximum 15 expression channels (MPE reserved channels 1 and 16).

---

### Question 4: API Design

**ANSWER**: **Option A - Explicit Harmony API**

**Composer Extension** (SynapticClip.ts):
```typescript
/**
 * Add a chord using HarmonyMask from @symphonyscript/theory.
 * Expands mask to individual notes via VoiceAllocator.
 */
harmony(mask: HarmonyMask, rootPitch: number, duration?: number): this {
  const allocator = new VoiceAllocator(this.bridge);
  allocator.allocateVoices(
    mask,
    rootPitch,
    duration ?? this.defaultDuration,
    this.currentTick,
    this.currentExpressionId
  );
  this.currentTick += duration ?? this.defaultDuration;
  return this;
}
```

**Usage**:
```typescript
import { pack, INTERVAL } from '@symphonyscript/theory';

const majorTriad = pack([INTERVAL.UNISON, INTERVAL.MAJOR_THIRD, INTERVAL.PERFECT_FIFTH]);

clip.harmony(majorTriad, 60, 480);  // C Major chord, quarter note
```

**Why Not Option B**: `.applyHarmony()` implies modifying existing note, but we're creating NEW notes. Option A is clearer semantically.

---

### Question 5: Loop Length

**ANSWER**: **Per-Clip Configuration**

**Implementation**:
```typescript
// SynapticClip.ts
private loopLength: number = Infinity;  // Default: no loop

/**
 * Set loop length for phase-locked playback.
 */
loop(ticks: number): this {
  this.loopLength = ticks;
  return this;
}
```

**Scheduler Usage**:
```typescript
// PhaseLockedScheduler.ts
class PhaseLockedScheduler {
  getPhasePosition(currentTick: number, loopLength: number): number {
    if (loopLength === Infinity) return currentTick;
    return currentTick % loopLength;
  }
}
```

**Global Override**: `Session.setGlobalLoopLength(ticks)` can set default for all clips.

---

## Complete File Inventory

### Files to CREATE:

```
packages/kernel/src/
├── scheduler/
│   ├── PhaseLockedScheduler.ts    [NEW] - 40 lines
│   └── index.ts                    [NEW] - Export
└── polyphony/
    ├── VoiceAllocator.ts           [NEW] - 60 lines
    └── index.ts                    [NEW] - Export

packages/kernel/src/__tests__/
├── PhaseLockedScheduler.test.ts   [NEW] - 5 tests
└── VoiceAllocator.test.ts         [NEW] - 5 tests

packages/composer/src/__tests__/
└── harmony.test.ts                 [NEW] - 4 tests
```

### Files to MODIFY:

```
packages/synaptic/src/
└── SynapticNode.ts                 [MODIFY] - Add expressionId param

packages/composer/src/
└── SynapticClip.ts                 [MODIFY] - Add .harmony(), .loop()

packages/kernel/src/
├── silicon-bridge.ts               [MODIFY] - Add expressionId to insertAsync
└── index.ts                        [MODIFY] - Export new modules

packages/kernel/
└── package.json                    [MODIFY] - Add theory dependency
```

---

## Detailed Pseudo-Code

### PhaseLockedScheduler.ts

```typescript
/**
 * RFC-047 Section 5.1: Phase-Locked Scheduler
 * Ignores history, calculates as Time % LoopLength
 */
export class PhaseLockedScheduler {
  /**
   * Calculate phase-locked playback position.
   * Guarantees eventual synchronization after CPU dropouts.
   */
  getPhasePosition(currentTick: number, loopLength: number): number {
    if (loopLength <= 0 || loopLength === Infinity) {
      return currentTick;
    }
    return currentTick % loopLength;
  }

  /**
   * Check if event should trigger at current phase position.
   */
  shouldTrigger(
    eventTick: number,
    currentTick: number,
    loopLength: number,
    toleranceTicks: number = 0
  ): boolean {
    const phasePosition = this.getPhasePosition(currentTick, loopLength);
    const eventPhase = this.getPhasePosition(eventTick, loopLength);
    return Math.abs(phasePosition - eventPhase) <= toleranceTicks;
  }
}
```

### VoiceAllocator.ts

```typescript
import { unpack, type HarmonyMask, type Interval24EDO } from '@symphonyscript/theory';
import type { SiliconBridge } from '../silicon-bridge';

/**
 * RFC-047 Section 6: Voice Allocator
 * Bitmask iteration for polyphonic playback
 */
export class VoiceAllocator {
  constructor(private bridge: SiliconBridge) {}

  /**
   * Allocate voices for a harmony mask.
   * Zero-allocation iteration via unpack() callback.
   * 
   * @param mask - 24-bit HarmonyMask from @symphonyscript/theory
   * @param rootPitch - MIDI root note (0-127)
   * @param velocity - MIDI velocity (0-127)
   * @param duration - Duration in ticks
   * @param baseTick - Start tick
   * @param baseExpressionId - Base MPE expression ID (voices get sequential IDs)
   */
  allocateVoices(
    mask: HarmonyMask,
    rootPitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    baseExpressionId: number = 0
  ): void {
    let voiceIndex = 0;

    unpack(mask, (interval: Interval24EDO) => {
      // Convert 24-EDO interval to semitones (2 steps = 1 semitone)
      const semitones = interval / 2;
      const pitch = Math.round(rootPitch + semitones);

      // Clamp to valid MIDI range
      const midiPitch = Math.max(0, Math.min(127, pitch));

      // Assign sequential expressionId for MPE
      const expressionId = (baseExpressionId + voiceIndex) % 15 + 1;  // MPE channels 1-15

      // Create note via bridge
      this.bridge.insertAsync(
        0x01,           // OPCODE.NOTE
        midiPitch,
        velocity,
        duration,
        baseTick,
        false,          // muted
        this.bridge.generateSourceId(),
        undefined,      // afterSourceId
        expressionId    // NEW: MPE expression ID
      );

      voiceIndex++;
    });
  }
}
```

---

## Test Strategy

### PhaseLockedScheduler.test.ts (5 tests)

1. `getPhasePosition returns currentTick when loopLength is Infinity`
2. `getPhasePosition wraps correctly at loop boundary`
3. `shouldTrigger returns true within tolerance`
4. `shouldTrigger returns false outside tolerance`
5. `handles zero and negative loopLength gracefully`

### VoiceAllocator.test.ts (5 tests)

1. `Allocates correct number of voices for major triad`
2. `Converts 24-EDO intervals to correct MIDI pitches`
3. `Assigns sequential expressionIds to voices`
4. `Wraps expressionId within MPE channel range (1-15)`
5. `Zero-allocation: only bridge.insertAsync called (no arrays)`

### harmony.test.ts (4 tests)

1. `clip.harmony() creates notes for all mask intervals`
2. `clip.harmony() advances currentTick by duration`
3. `clip.harmony() respects currentExpressionId`
4. `clip.loop() sets loopLength`

---

## Directive to Engineer

**IMPLEMENT FULL PHASE 3 as specified:**

1. Create `PhaseLockedScheduler.ts` with modulo-based phase calculation
2. Create `VoiceAllocator.ts` using `@symphonyscript/theory` imports
3. Extend `SynapticNode.addNote()` with `expressionId` parameter
4. Extend `SiliconBridge.insertAsync()` with 9th parameter
5. Add `.harmony()` and `.loop()` to `SynapticClip`
6. Write 14 tests (5 + 5 + 4)
7. Verify all tests pass
8. Submit walkthrough

**Estimated Time**: 3-4 hours  
**Estimated Tests**: 14 tests  
**Estimated Lines**: ~200 lines new code

---

**Architect Signature**: Zero-Trust Reviewer  
**Timestamp**: 2025-12-25T06:15:43+04:00  
**Status**: FULL IMPLEMENTATION REQUIRED
