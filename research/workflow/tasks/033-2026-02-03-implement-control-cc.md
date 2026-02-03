# Task 033: Implement control() for MIDI CC

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to send arbitrary MIDI Control Change messages.

## Current State

No `control()` method exists on clips.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:268-270
control(controller: number, value: number): this {
    return this.addOp({ kind: 'control', controller, value })
}
```

## Required Implementation

1. Add `ControlOp` type
2. Implement `control(controller, value)` on SynapticClip
3. Add escape method to cursors

## Example

```typescript
melody
    .control(1, 64)   // CC1 (Mod wheel) = 64
    .control(7, 100)  // CC7 (Volume) = 100
    .note('C4').commit()
```

## Common CC Numbers

| CC | Name |
|----|------|
| 1 | Modulation |
| 2 | Breath |
| 7 | Volume |
| 10 | Pan |
| 11 | Expression |
| 64 | Sustain |
| 74 | Brightness |

## Acceptance Criteria

- [ ] `control(cc, value)` works
- [ ] Value range 0-127
- [ ] Escape from cursor works
- [ ] Tests for control messages
