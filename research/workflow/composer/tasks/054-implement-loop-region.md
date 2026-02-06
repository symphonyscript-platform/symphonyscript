# Task 054: Implement Loop Region

**Priority:** MEDIUM  
**Category:** Dead Code Fix  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit N-003

---

## Problem

`setLoopRegion()` sets `loopEnabled`, `loopStart`, `loopEnd` state but this state is never consumed. The loop region API exists but has no effect on playback.

## Current State

```typescript
// clips/SynapticClip.ts:33-35
protected loopEnabled: boolean = false;
protected loopStart: number = 0;
protected loopEnd: number = 0;

// setLoopRegion() sets these but they're never read
```

## Required Implementation

### Add to ClipNode Type

```typescript
// types.ts
export interface ClipNode {
    // ... existing fields ...
    loopRegion?: {
        start: number;
        end: number;
        enabled: boolean;
    };
}
```

### Wire to build()

```typescript
// SynapticClip.ts
build(): ClipNode {
    return {
        // ... existing fields ...
        loopRegion: this.loopEnabled ? {
            start: this.loopStart,
            end: this.loopEnd,
            enabled: true
        } : undefined
    };
}
```

### MockConsumer Integration

```typescript
// @symphonyscript/kernel mock-consumer.ts
// In playback loop:
if (this.clipNode.loopRegion?.enabled) {
    if (this.currentTick >= this.clipNode.loopRegion.end) {
        this.currentTick = this.clipNode.loopRegion.start;
    }
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/types.ts`
- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/kernel/src/mock-consumer.ts` (or equivalent)
- `[NEW] packages/composer/src/__tests__/LoopRegion.test.ts`

## Acceptance Criteria

- [ ] `setLoopRegion(0, 480)` includes loop data in built clip
- [ ] `build().loopRegion` contains correct start/end
- [ ] MockConsumer loops back when reaching end
- [ ] No loop if `loopEnabled` is false
- [ ] New `LoopRegion.test.ts` passes
