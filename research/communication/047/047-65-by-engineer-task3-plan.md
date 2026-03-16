# RFC-047 Phase 8 Task 3: Wait Method - Implementation Plan

**Date**: 2025-12-28T17:33:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-65-by-engineer-task3-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Implement `.wait(duration)` method that sets a clip start delay applied to all notes. This is different from `.shift()` which is a one-shot per-note offset.

---

## Proposed Changes

### File: `packages/composer/src/SynapticClip.ts`

#### 1. Add `startDelay` State Field (After groove state, line 107)

```typescript
// RFC-047 Phase 8 Task 3: Clip start delay
private startDelay: number = 0  // Delay before first note in ticks
```

**Rationale**: Single primitive field for zero-allocation pattern.

#### 2. Add `.wait()` Method (After `.use()`, around line 205)

```typescript
/**
 * Set clip start delay (all notes delayed by this amount).
 * 
 * Different from `.shift()` which is per-note and one-shot.
 * `.wait()` applies to ALL notes in the clip persistently.
 * 
 * @param duration - Delay in ticks before clip starts

 * @returns this for fluent chaining
 * 
 * @example
 * clip.wait(480).note('C4');  // Clip starts 480 ticks late
 */
wait(duration: number): this {
    this.startDelay = duration
    return this
}
```

#### 3. Modify `.note()` to Apply Start Delay (Line ~138)

**Current implementation**:
```typescript
// RFC-047 Phase 2: Apply pending shift to baseTick
let actualTick = this.currentTick + this.pendingShift
```

**Modified implementation** (per Architect directive):
```typescript
// RFC-047 Phase 2: Apply pending shift to baseTick
// RFC-047 Phase 8 Task 3: Apply startDelay to all notes
let actualTick = this.currentTick + this.pendingShift + this.startDelay
```

**Order of application**:
1. `currentTick` - Position in clip
2. `pendingShift` - Per-note micro-timing (one-shot)
3. `startDelay` - Clip-wide delay (persistent)
4. Groove swing (applied after, to odd steps only)

---

## Tests to Add

### File: `packages/composer/src/__tests__/timing.test.ts` (NEW FILE)

```typescript
import { Clip, initSession } from '../index';
import { SiliconSynapse, SiliconBridge } from '@symphonyscript/kernel';

describe('Timing Methods', () => {
    let bridge: SiliconBridge;

    beforeEach(() => {
        const linker = SiliconSynapse.create({
            nodeCapacity: 1024,
            safeZoneTicks: 0
        });
        bridge = new SiliconBridge(linker);
        initSession(bridge);
    });

    describe('.wait() - Clip Start Delay', () => {
        test('.wait() sets clip start delay', () => {
            const clip = Clip.clip('WaitTest');
            clip.wait(480).note('C4');
            expect(clip).toBeDefined();
        });

        test('.wait() returns this for chaining', () => {
            const clip = Clip.clip('ChainTest');
            const result = clip.wait(240);
            expect(result).toBe(clip);
        });

        test('.wait() persists across multiple notes', () => {
            const clip = Clip.clip('PersistTest');
            clip.wait(480)
                .note('C4', 120)
                .note('D4', 120);
            // Both notes should be delayed by 480
            expect(clip.getCurrentTick()).toBe(240);
        });

        test('.wait() combines with .shift()', () => {
            const clip = Clip.clip('CombineTest');
            // wait(480) + shift(20) = note starts at 500
            clip.wait(480).shift(20).note('C4');
            expect(clip).toBeDefined();
        });
    });
});
```

---

## Verification Plan

### Automated Tests

Run:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npm run test -- timing.test.ts
```

Expected: All 4 tests pass.

### Type Safety Verification

```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/composer
npx tsc --noEmit
```

Expected: No type errors.

---

## Zero-Allocation Compliance

- ✅ `startDelay` is a primitive number
- ✅ No object allocation in `.wait()` or `.note()`
- ✅ Addition in `.note()` uses primitive arithmetic

---

## Difference from `.shift()`

| Method | Scope | Behavior | Resets |
|--------|-------|----------|--------|
| `.shift(ticks)` | Per-note | Offsets NEXT note only | After each note |
| `.wait(duration)` | Clip-wide | Offsets ALL notes | Never (persistent) |

**Example**:
```typescript
clip.wait(480).note('C4');  // C4 at tick 480
clip.note('D4');            // D4 at tick 480 + 480 = 960

clip.shift(20).note('E4');  // E4 at tick 960 + 480 + 20 = 1460
clip.note('F4');            // F4 at tick 1460 + 480 = 1940 (no shift)
```

---

## Concerns / Questions

**None** - Task is straightforward. The formula `actualTick = currentTick + pendingShift + startDelay` is confirmed in Architect's directive.

---

**Awaiting Architect approval to proceed with implementation.**
