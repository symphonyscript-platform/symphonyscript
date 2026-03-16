# RFC-047 Phase 8 Task 2: Groove Integration - Implementation Plan

**Date**: 2025-12-25T21:45:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-61-by-engineer-task2-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Integrate `GrooveBuilder` with `SynapticClip` by implementing `.use(groove)` method that stores groove template in clip state and applies swing offset to notes based on step position.

---

## Proposed Changes

### File: `packages/composer/src/SynapticClip.ts`

#### 1. Add Groove State to Class (Lines 95-101 area)

**Current state fields**:
```typescript
private builder: SynapticNode
private bridge: SiliconBridge
private currentTick: number = 0
private defaultDuration: number = 480
private defaultVelocity: number = 100
private pendingShift: number = 0
private currentExpressionId: number = 0
```

**Add groove state** (zero-allocation pattern - store primitives):
```typescript
// RFC-047 Phase 8 Task 2: Groove template state
private grooveSwing: number = 0.5  // Default: no swing
private grooveSteps: number = 4     // Default: 16th notes
private grooveStepDuration: number = 0  // Calculated from steps
private currentStepIndex: number = 0    // Track position within groove cycle
```

**Rationale**: 
- Store primitives instead of groove object reference (zero-allocation in hot path)
- `grooveStepDuration` pre-computed to avoid division in `.note()`
- `currentStepIndex` tracks position for determining odd/even steps

#### 2. Add `.use()` Method (After `.play()`, around line 165)

```typescript
/**
 * Apply a groove template to downstream notes.
 * 
 * Swing is applied to odd steps (1, 3, 5...) within the groove cycle.
 * Per RFC-047 Phase 8 Task 2 requirements.
 * 
 * @param groove - Frozen groove template from GrooveBuilder

 * @returns this for fluent chaining
 * 
 * @example
 * const mpc = Clip.groove().swing(0.55).steps(4).build();
 * clip.use(mpc).note('C4').note('D4');  // D4 will have swing offset
 */
use(groove: Readonly<{ swing: number; steps: number }>): this {
    this.grooveSwing = groove.swing
    this.grooveSteps = groove.steps
    // Pre-compute step duration for zero-allocation
    // Assumes 480 PPQ, quarter note = 480 ticks, 16th note = 120 ticks
    // stepDuration = (quarter note / 4) / (steps / 4)
    this.grooveStepDuration = 480 / groove.steps
    this.currentStepIndex = 0
    return this
}
```

#### 3. Modify `.note()` Method to Apply Groove (Lines 118-137)

**Current implementation** (line 124):
```typescript
// RFC-047 Phase 2: Apply pending shift to baseTick
const actualTick = this.currentTick + this.pendingShift
```

**Modified implementation**:
```typescript
// RFC-047 Phase 2: Apply pending shift to baseTick
let actualTick = this.currentTick + this.pendingShift

// RFC-047 Phase 8 Task 2: Apply groove swing
if (this.grooveSwing !== 0.5) {
    // Odd steps (1, 3, 5...) get swing offset
    const isOddStep = (this.currentStepIndex % 2) === 1
    if (isOddStep) {
        const swingOffset = (this.grooveSwing - 0.5) * this.grooveStepDuration
        actualTick = actualTick + swingOffset
    }
}
```

**After note is added** (line 133, after `this.currentTick += noteDuration`):
```typescript
this.currentTick += noteDuration
this.pendingShift = 0  // Reset shift (one-shot behavior)

// RFC-047 Phase 8 Task 2: Advance groove step
this.currentStepIndex = this.currentStepIndex + 1
if (this.currentStepIndex >= this.grooveSteps) {
    this.currentStepIndex = 0  // Wrap around
}
```

**Rationale**:
- Swing formula from directive: `offset = groove.swing * stepDuration` for odd steps
- Adjusted formula: `(swing - 0.5) * stepDuration` so swing=0.5 means no offset
- Check `swing !== 0.5` to skip calculation when no swing applied (optimization)
- Step index advances with each note to track position in groove cycle

#### 4. Add Groove Import (Line 11-13 area)

**Current**:
```typescript
import type { SiliconBridge } from '@symphonyscript/kernel'
import { SynapticNode, VoiceAllocator } from '@symphonyscript/synaptic'
import type { HarmonyMask } from '@symphonyscript/theory'
```

**Add** (no actual import needed - type is inline in method signature):
No changes needed - `Readonly<{ swing: number; steps: number }>` is an inline type.

---

## Tests to Add

### File: `packages/composer/src/__tests__/groove-integration.test.ts` (NEW FILE)

```typescript
import { Clip, initSession } from '../index';
import { SiliconSynapse, SiliconBridge } from '@symphonyscript/kernel';

describe('Groove Integration', () => {
    let bridge: SiliconBridge;

    beforeEach(() => {
        const linker = SiliconSynapse.create({
            nodeCapacity: 1024,
            safeZoneTicks: 0
        });
        bridge = new SiliconBridge(linker);
        initSession(bridge);
    });

    test('.use() accepts groove template', () => {
        const mpc = Clip.groove().swing(0.55).steps(4).build();
        const clip = Clip.clip('Groove');
        clip.use(mpc).note('C4').note('D4');
        expect(clip).toBeDefined();
    });

    test('.use() returns this for chaining', () => {
        const groove = Clip.groove().swing(0.6).build();
        const clip = Clip.clip('ChainTest');
        const result = clip.use(groove);
        expect(result).toBe(clip);
    });

    test('Swing applies to odd steps', () => {
        const groove = Clip.groove().swing(0.66).steps(4).build();
        const clip = Clip.clip('SwingTest');
        
        // Note 1: step 0 (even) - no swing
        // Note 2: step 1 (odd) - swing applied
        // Note 3: step 2 (even) - no swing
        // Note 4: step 3 (odd) - swing applied
        clip.use(groove)
            .note('C4', 120)
            .note('D4', 120)
            .note('E4', 120)
            .note('F4', 120);
        
        // Verify clip was built without errors
        expect(clip.getCurrentTick()).toBe(480);
    });

    test('Step index wraps around after groove.steps', () => {
        const groove = Clip.groove().swing(0.6).steps(2).build();
        const clip = Clip.clip('WrapTest');
        
        clip.use(groove)
            .note('C4', 120)  // Step 0
            .note('D4', 120)  // Step 1
            .note('E4', 120)  // Step 0 (wrapped)
            .note('F4', 120); // Step 1
        
        expect(clip.getCurrentTick()).toBe(480);
    });

    test('No swing when swing=0.5 (default)', () => {
        const groove = Clip.groove().swing(0.5).steps(4).build();
        const clip = Clip.clip('NoSwing');
        
        clip.use(groove).note('C4').note('D4');
        
        // swing=0.5 means no offset, should behave normally
        expect(clip.getCurrentTick()).toBe(960);
    });

    test('Multiple grooves can be applied', () => {
        const groove1 = Clip.groove().swing(0.55).build();
        const groove2 = Clip.groove().swing(0.66).build();
        const clip = Clip.clip('MultiGroove');
        
        clip.use(groove1).note('C4');
        clip.use(groove2).note('D4');  // Replaces groove1
        
        expect(clip).toBeDefined();
    });
});
```

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- groove-integration.test.ts
```

Expected: All 6 new tests pass.

### Type Safety Verification

Verify TypeScript compilation with:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npx tsc --noEmit
```

Expected: No type errors.

---

## Zero-Allocation Compliance

- ✅ Groove state stored as primitives (4 numbers)
- ✅ No object allocation in `.note()` hot path
- ✅ Pre-computed `grooveStepDuration` avoids division
- ✅ Modulo operation (`%`) for odd step check is primitive
- ✅ Step index increment uses `+ 1` per RFC-045-04

---

## Swing Formula Verification

Per directive: `offset = groove.swing * stepDuration` for odd steps

**Adjusted formula**: `offset = (groove.swing - 0.5) * stepDuration`

**Rationale**:
- `swing = 0.5` → offset = 0 (no swing, straight timing)
- `swing = 0.66` → offset = 0.16 * stepDuration (classic MPC swing)
- `swing = 0.55` → offset = 0.05 * stepDuration (light swing)

**Example** (steps=4, stepDuration=120 ticks, swing=0.66):
- Note 1 (step 0, even): no offset
- Note 2 (step 1, odd): offset = (0.66 - 0.5) * 120 = 19.2 ticks late
- Note 3 (step 2, even): no offset
- Note 4 (step 3, odd): offset = 19.2 ticks late

---

## Concerns / Questions

**Question**: The directive states "odd steps (1, 3, 5...)" but doesn't clarify if indexing is 0-based or 1-based. I've implemented using 0-based indexing where:
- Step 0 (even) = no swing
- Step 1 (odd) = swing applied
- Step 2 (even) = no swing
- Step 3 (odd) = swing applied

If the Architect intended 1-based indexing, I can adjust the logic to:
```typescript
const isOddStep = ((this.currentStepIndex + 1) % 2) === 1
```

**Question**: Should `.rest()` advance the groove step index? Currently, my plan only advances it in `.note()`. If rests should also advance the step, I will add the same increment logic to `.rest()`.

---

**Awaiting Architect approval to proceed with implementation.**
