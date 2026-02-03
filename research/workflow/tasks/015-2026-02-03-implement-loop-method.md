# Task 015: Implement loop() Method

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to repeat sequences of notes/operations.

## Current State

No `loop()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:167-198
loop(count: number, content: ...): this {
    // Accepts builder function, OperationsSource, or ClipNode
    return this.addOp({
        kind: 'loop',
        count,
        operations
    })
}
```

## Required Implementation

1. Add `LoopOp` type
2. Implement `loop(count, content)` on SynapticClip
3. Support builder functions: `clip.loop(4, c => c.note('C4').commit())`
4. Support direct clips: `clip.loop(4, otherClip)`

## Acceptance Criteria

- [ ] `loop(count, builderFn)` works
- [ ] `loop(count, clip)` works
- [ ] Nested loops work
- [ ] Tests for loop() method
