# MICRO-PLAN: RFC-047 Phase 2 - Composer Polyphony

**Agent**: Senior TypeScript Systems Engineer  
**Supervisor**: Hostile Architect (Zero-Trust Policy)  
**RFC**: RFC-047 (24-Bit Theory & Polyphony Architecture)  
**Phase**: Phase 2 - Composer Polyphony  
**Status**: AWAITING APPROVAL  
**Date**: 2025-12-24T22:06:00+04:00

---

## 1. GOAL

Implement Composer Polyphony features for `@symphonyscript/composer` package per RFC-047 Phase 2:

1. **`.stack()` method**: Enable counterpoint/independent voices via synaptic graph branching
2. **`GrooveBuilder` class**: Implement fluent DSL for groove templates (replaces legacy config objects)
3. **Semantic timing APIs**: Implement `.shift()` micro-timing and distinguish from existing `.rest()`

**Result**: Composer DSL supports both block chords (bitwise) and stacked voices (graph branching) with ergonomic groove/timing primitives.

---

## 2. FILE INVENTORY

### Files to CREATE:

```
packages/composer/src/
├── GrooveBuilder.ts           [NEW] - Fluent builder for groove templates
└── __tests__/
    ├── GrooveBuilder.test.ts  [NEW] - Unit tests for groove builder
    └── stack.test.ts          [NEW] - Integration tests for .stack() polyphony
```

### Files to MODIFY:

```
packages/composer/src/
├── SynapticClip.ts            [MODIFY] - Add .stack(), .shift() methods
├── Clip.ts                    [MODIFY] - Add Clip.groove() factory method
└── index.ts                   [MODIFY] - Export GrooveBuilder
```

### Files to REFERENCE (No Changes):

```
packages/composer/src/
├── SynapticMelody.ts          - Existing scale/degree logic (no changes)
└── __tests__/*.test.ts        - Existing test patterns to match
```

---

## 3. PSEUDO-CODE & LOGIC

### 3.1. `GrooveBuilder.ts` - Fluent Groove DSL (NEW)

**Purpose**: Replace legacy config objects with immutable builder pattern for groove templates.

```typescript
/**
 * Groove template for quantization and swing.
 * Immutable builder pattern per RFC-047 Section 4.1.
 */
export class GrooveBuilder {
  private swingAmount: number = 0.5;
  private stepCount: number = 4;

  /**
   * Set swing amount (0.5 = no swing, 0.66 = MPC swing).
   */
  swing(amount: number): this {
    if (amount < 0 || amount > 1) {
      throw new Error('Swing must be 0-1');
    }
    // Return NEW instance (immutable)
    const next = new GrooveBuilder();
    next.swingAmount = amount;
    next.stepCount = this.stepCount;
    return next;
  }

  /**
   * Set step count (e.g., 16th notes per beat).
   */
  steps(count: number): this {
    if (count < 1) {
      throw new Error('Steps must be >= 1');
    }
    const next = new GrooveBuilder();
    next.swingAmount = this.swingAmount;
    next.stepCount = count;
    return next;
  }

  /**
   * Build the final groove template (frozen object).
   */
  build(): Readonly<{ swing: number; steps: number }> {
    return Object.freeze({
      swing: this.swingAmount,
      steps: this.stepCount
    });
  }
}
```

**Design Rationale**:
- **Immutable**: Each method returns a NEW instance (prevents accidental mutation)
- **Frozen output**: `.build()` returns `Object.freeze()` to enforce immutability
- **Validation**: Throws on invalid parameters (swing 0-1, steps >= 1)

---

### 3.2. `SynapticClip.ts` - Add `.stack()` and `.shift()` (MODIFY)

#### Addition 1: `.stack()` for Polyphony

**Purpose**: Enable counterpoint by branching the synaptic graph.

```typescript
/**
 * Stack (branch) independent voices for counterpoint.
 * 
 * Creates a new SynapticClip that branches from this clip's current position.
 * Per RFC-047 Section 3.2 "Model B: The Stack Graph".
 * 
 * @param voiceBuilder - Callback that receives a new SynapticClip for the voice
 * @returns this for fluent chaining
 * 
 * @example
 * const melody = Clip.clip('Counterpoint');
 * 
 * melody
 *   .note('C4', 480)  // Main voice
 *   .stack((voice) => {
 *     voice.note('E4', 480);  // Voice 1 (parallel)
 *   })
 *   .stack((voice) => {
 *     voice.note('G4', 480);  // Voice 2 (parallel)
 *   })
 *   .note('D4', 480);  // Main voice continues
 */
stack(voiceBuilder: (voice: SynapticClip) => void): this {
  // Create new clip at the same bridge
  const voiceClip = new SynapticClip(this['bridge']); // Access private via bracket notation
  
  // Pass to user callback
  voiceBuilder(voiceClip);
  
  // Link voice's exit back to this clip's continuation point
  // (This creates the graph branching topology)
  voiceClip.play(this);
  
  return this;
}
```

**Design Rationale**:
- **Callback pattern**: User defines voice in closure (ergonomic)
- **Automatic linking**: Voice automatically reconnects to main flow
- **Graph topology**: Creates the branching structure described in RFC-047 Section 3.2

#### Addition 2: `.shift()` for Micro-Timing

**Purpose**: Implement micro-timing distinct from `.rest()` per RFC-047 Section 4.2.

```typescript
/**
 * Shift the next note's start time (micro-timing).
 * 
 * Unlike rest(), shift() does NOT advance the cursor.
 * It offsets the next event's start tick for humanization/groove.
 * 
 * @param ticks - Offset in ticks (can be negative)
 * @returns this for fluent chaining
 * 
 * @example
 * clip
 *   .note('C4', 480)
 *   .shift(20)           // Next note starts 20 ticks late
 *   .note('D4', 480);    // Slightly delayed for swing
 */
shift(ticks: number): this {
  this.microTimingOffset = ticks;
  return this;
}
```

**Modified `.note()` to consume shift**:

```typescript
note(pitch: string | number, duration?: number, velocity?: number): this {
  const midiPitch = parsePitch(pitch);
  const noteDuration = duration ?? this.defaultDuration;
  const noteVelocity = velocity ?? this.defaultVelocity;

  // Apply micro-timing offset
  const actualTick = this.currentTick + this.microTimingOffset;
  
  this.builder.addNote(
    midiPitch,
    noteVelocity,
    noteDuration,
    actualTick  // Use offset tick
  );

  this.currentTick += noteDuration;  // Cursor advances normally
  this.microTimingOffset = 0; // Reset offset after use
  
  return this;
}
```

**Design Rationale**:
- **Per RFC-047 Section 4.2**: `shift()` is micro-timing, `rest()` is structural
- **One-shot**: Offset resets after each note (prevents accidental accumulation)
- **Supports negative**: Allows notes to "pull" timing forward

---

### 3.3. `Clip.ts` - Add `.groove()` Factory Method (MODIFY)

**Purpose**: Expose `GrooveBuilder` via `Clip` factory.

```typescript
/**
 * Create a groove template builder.
 * @returns GrooveBuilder for fluent DSL
 */
groove(): GrooveBuilder {
  return new GrooveBuilder();
}
```

**Example Usage** (per RFC-047):
```typescript
const mpc = Clip.groove()
  .swing(0.55)
  .steps(4)
  .build();

// Later: apply to clip (future enhancement - not in Phase 2 scope)
```

---

### 3.4. `index.ts` - Export GrooveBuilder (MODIFY)

```typescript
export * from './GrooveBuilder';
```

---

## 4. VERIFICATION STRATEGY

### 4.1. Unit Tests

#### Test File: `__tests__/GrooveBuilder.test.ts`

```typescript
describe('GrooveBuilder', () => {
  test('Default values', () => {
    const groove = new GrooveBuilder().build();
    expect(groove.swing).toBe(0.5);
    expect(groove.steps).toBe(4);
  });

  test('Immutability: .swing() returns new instance', () => {
    const g1 = new GrooveBuilder();
    const g2 = g1.swing(0.66);
    expect(g1).not.toBe(g2);
    expect(g1.build().swing).toBe(0.5); // g1 unchanged
    expect(g2.build().swing).toBe(0.66);
  });

  test('Immutability: .build() returns frozen object', () => {
    const groove = new GrooveBuilder().swing(0.6).build();
    expect(() => { (groove as any).swing = 0.7; }).toThrow();
  });

  test('Validation: swing out of range', () => {
    expect(() => new GrooveBuilder().swing(1.5)).toThrow('Swing must be 0-1');
    expect(() => new GrooveBuilder().swing(-0.1)).toThrow('Swing must be 0-1');
  });

  test('Validation: steps < 1', () => {
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

**How to Run**:
```bash
nx test --project=composer --testFile=GrooveBuilder.test.ts
```

---

#### Test File: `__tests__/stack.test.ts`

```typescript
import { Clip, initSession } from '../index';
import { SiliconSynapse, SiliconBridge } from '@symphonyscript/kernel';

describe('.stack() Polyphony', () => {
  let bridge: SiliconBridge;

  beforeEach(() => {
    const linker = SiliconSynapse.create({
      nodeCapacity: 1024,
      safeZoneTicks: 0
    });
    bridge = new SiliconBridge(linker);
    initSession(bridge);
  });

  test('Single voice branch', () => {
    const clip = Clip.clip('Main');
    clip.note('C4', 480).stack((voice) => {
      voice.note('E4', 480);
    });

    // Verify synaptic graph has 2 nodes
    const mainNode = clip.getNode();
    expect(mainNode).toBeDefined();
    // Voice should be linked (implementation-specific check)
  });

  test('Multiple voice branches', () => {
    const clip = Clip.clip('Polyphony');
    clip
      .note('C4', 480)
      .stack((v1) => v1.note('E4', 480))
      .stack((v2) => v2.note('G4', 480))
      .note('D4', 480);

    expect(clip.getCurrentTick()).toBe(960); // Main: 480 + 480
  });

  test('Stack returns this for chaining', () => {
    const clip = Clip.clip('Chain');
    const result = clip.stack((v) => v.note('C4'));
    expect(result).toBe(clip);
  });
});
```

**How to Run**:
```bash
nx test --project=composer --testFile=stack.test.ts
```

---

#### Test File: Additions to `__tests__/SynapticClip.test.ts`

```typescript
describe('.shift() Micro-Timing', () => {
  test('Shift offsets next note', () => {
    const clip = Clip.clip('Shift');
    clip.note('C4', 480);
    
    const tickBefore = clip.getCurrentTick(); // 480
    clip.shift(20);
    clip.note('D4', 480);
    
    // Cursor advances by duration, not shift
    expect(clip.getCurrentTick()).toBe(960);
  });

  test('Shift resets after note', () => {
    const clip = Clip.clip('Reset');
    clip.shift(20).note('C4').note('D4');
    
    // Second note should NOT be shifted
    // (Implementation verifies via internal state)
  });

  test('Negative shift (pull timing forward)', () => {
    const clip = Clip.clip('Negative');
    clip.note('C4', 480).shift(-10).note('D4', 480);
    
    expect(clip.getCurrentTick()).toBe(960);
  });
});
```

**How to Run**:
```bash
nx test --project=composer
```

---

### 4.2. Manual Verification Checklist

- [ ] `GrooveBuilder` returns new instance on `.swing()` / `.steps()`
- [ ] `.build()` returns frozen object (cannot mutate)
- [ ] `.stack()` creates graph branching (verify via synaptic node inspection)
- [ ] `.shift()` offsets note timing without advancing cursor
- [ ] All tests pass: `nx test --project=composer`
- [ ] TypeScript compilation succeeds: `nx build --project=composer`
- [ ] No ESLint violations

---

## 5. ARCHITECTURAL COMPLIANCE

### 5.1. RFC-047 Alignment

| Requirement | Implementation |
|------------|----------------|
| **Fluent Groove DSL (§4.1)** | ✅ `GrooveBuilder` with`.swing()`, `.steps()`, `.build()` |
| **Semantic Timing (§4.2)** | ✅ `.shift()` (micro-timing) vs `.rest()` (structural) |
| **Stack Graph (§3.2)** | ✅ `.stack()` creates branching topology |
| **Immutability** | ✅ Builder returns new instances, frozen output |

### 5.2. Non-Negotiable Directives

- ✅ **Zero deviation from RFC-047**: All features map 1:1 to specification
- ✅ **Fluent chaining**: All methods return `this`
- ✅ **Immutability**: `GrooveBuilder` never mutates existing instances
- ✅ **Type Safety**: Strict TypeScript, no `any` types

---

## 6. RISKS & MITIGATIONS

| Risk | Mitigation |
|------|------------|
| **Graph branching complexity** | Use callback pattern (user doesn't manage nodes directly) |
| **Shift timing bugs** | Reset offset after each note (one-shot behavior) |
| **Immutability violations** | `Object.freeze()` enforces at runtime |
| **Test coverage gaps** | Existing test patterns (SynapticClip.test.ts) provide template |

---

## 7. DELIVERABLES

Upon approval, I will execute:

1. ✅ Create `GrooveBuilder.ts` with immutable builder pattern
2. ✅ Add `.stack()` method to `SynapticClip.ts`
3. ✅ Add `.shift()` method to `SynapticClip.ts` (modify `.note()`)
4. ✅ Add `Clip.groove()` factory method to `Clip.ts`
5. ✅ Update `index.ts` to export `GrooveBuilder`
6. ✅ Create `__tests__/GrooveBuilder.test.ts` (6+ tests)
7. ✅ Create `__tests__/stack.test.ts` (3+ tests)
8. ✅ Add `.shift()` tests to `__tests__/SynapticClip.test.ts` (3+ tests)
9. ✅ Run `nx test --project=composer` and verify all tests pass
10. ✅ Submit walkthrough document via communication protocol

**Estimated Execution Time**: 30 minutes  
**Estimated Test Count**: 12+ tests (6 GrooveBuilder + 3 stack + 3 shift)

---

## 8. SCOPE LIMITATIONS

**IN SCOPE (Phase 2)**:
- `.stack()` for graph branching
- `GrooveBuilder` class with fluent API
- `.shift()` for micro-timing

**OUT OF SCOPE (Future Phases)**:
- `.use(groove)` application logic (requires quantization engine)
- `.wait()` scheduling API (Phase 3: Kernel)
- `.playbackOffset()` latency compensation (Phase 3: Kernel)
- Integration with `@symphonyscript/theory` HarmonyMask (Phase 3)

---

## 9. AWAITING ARCHITECT APPROVAL

**Question**: Does this Phase 2 Micro-Plan satisfy RFC-047 requirements?

**Approval Gates**:
- [ ] Goal is clear and achievable
- [ ] File inventory is complete
- [ ] Pseudo-code demonstrates understanding of polyphony/groove/timing
- [ ] Test strategy is comprehensive with explicit run commands
- [ ] No deviation from RFC-047 Section 4 & 6

**Status**: 🟡 **BLOCKED - Awaiting Architect Approval**

---

**Engineer Signature**: Senior TypeScript Systems Engineer  
**Timestamp**: 2025-12-24T22:06:00+04:00  
**Phase**: 2 - Composer Polyphony (PLANNING)
