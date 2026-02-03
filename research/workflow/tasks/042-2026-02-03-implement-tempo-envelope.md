# Task 042: Implement tempoEnvelope()

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No complex multi-keyframe tempo transitions.

## Current State

Only instant tempo changes via `tempo(bpm)`.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:747-757
tempoEnvelope(keyframes: TempoKeyframe[]): this {
    if (keyframes.length < 2) {
        throw new Error('tempoEnvelope validation error: need at least 2 keyframes')
    }
    const last = keyframes[keyframes.length - 1]
    
    return this.addOp(Actions.tempo(last.bpm, {
        duration: last.beat - keyframes[0].beat,
        envelope: { keyframes }
    }))
}

interface TempoKeyframe {
    beat: number
    bpm: number
    curve?: TempoCurve
}
```

## Required Implementation

1. Add `TempoKeyframe` type
2. Add `TempoEnvelope` type
3. Implement `tempoEnvelope(keyframes)` on SynapticMelody
4. Add escape method to cursor

## Example

```typescript
melody.tempoEnvelope([
    { beat: 0, bpm: 120 },
    { beat: 4, bpm: 140, curve: 'ease-in' },
    { beat: 8, bpm: 120, curve: 'ease-out' }
])
```

## Acceptance Criteria

- [ ] `tempoEnvelope([...])` works
- [ ] Minimum 2 keyframes required
- [ ] Curve types respected
- [ ] Tests for tempo envelope
