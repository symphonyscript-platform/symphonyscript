# Task 034: Implement aftertouch()

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No aftertouch/pressure events.

## Current State

No `aftertouch()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:711-720
aftertouch(value: number, options?: { type?: 'channel' | 'poly'; note?: NoteName }): this {
    const op: AftertouchOp = {
        kind: 'aftertouch',
        type: options?.type ?? 'channel',
        value,
        note: options?.note
    }
    return this.addOp(op)
}
```

## Required Implementation

1. Add `AftertouchOp` type
2. Implement `aftertouch(value, options)` on SynapticMelody
3. Support channel and polyphonic aftertouch
4. Add escape method to cursor

## Example

```typescript
melody
    .note('C4').commit()
    .aftertouch(0.8)                    // Channel aftertouch
    .aftertouch(0.5, { type: 'poly', note: 'C4' })  // Poly aftertouch
```

## Acceptance Criteria

- [ ] `aftertouch(value)` sends channel aftertouch
- [ ] `aftertouch(value, { type: 'poly', note })` sends poly aftertouch
- [ ] Value normalized 0-1
- [ ] Tests for aftertouch
