# Task 038: Implement freeze() for Incremental Compilation

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to pre-compile clips for reuse.

## Current State

No `freeze()` method or `FrozenClip` class exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:276-280
freeze(options: BlockCompileOptions): FrozenClip {
    const clipNode = this.build()
    const block = compileBlock(clipNode, options)
    return new FrozenClip(block, clipNode)
}

class FrozenClip {
    constructor(
        public readonly block: CompiledBlock,
        public readonly sourceClip: ClipNode
    ) {}
}
```

## Required Implementation

1. Implement `FrozenClip` class
2. Implement `freeze(options)` on SynapticClip
3. Update `play()` to accept FrozenClip

## Example

```typescript
const riff = melody
    .note('C4').commit()
    .note('E4').commit()
    .note('G4').commit()
    .freeze({ bpm: 120 })

// Use multiple times without recompilation
mainClip
    .play(riff)
    .rest('1n')
    .play(riff)
```

## Acceptance Criteria

- [ ] `FrozenClip` class exists
- [ ] `freeze(options)` returns FrozenClip
- [ ] `play(frozenClip)` works
- [ ] Frozen clips are not re-expanded
- [ ] Tests for freeze
