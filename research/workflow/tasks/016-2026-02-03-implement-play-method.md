# Task 016: Implement play() Method

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to compose clips together or play external clips inline.

## Current State

No `play()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:108-125
play(item: ClipBuilder<any> | ClipOperation | FrozenClip | ClipNode): this {
    if (item instanceof FrozenClip) {
        return this.addOp({ kind: 'block', block: item.block })
    }
    if (item instanceof ClipBuilder) {
        return this.addOp({ kind: 'clip', clip: item.build() })
    }
    // ...
}
```

## Required Implementation

1. Add `ClipOp` type
2. Implement `play(item)` on SynapticClip
3. Support ClipNodes, other clips, operations

## Acceptance Criteria

- [ ] `play(clip)` inserts clip operations
- [ ] `play(operation)` inserts single operation
- [ ] Tests for play() method
