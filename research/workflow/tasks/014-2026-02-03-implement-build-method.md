# Task 014: Implement build() Method

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

Clips have no way to output a `ClipNode` data structure for serialization or compilation.

## Current State

No `build()` method exists on `SynapticClip` or `SynapticMelody`/`SynapticDrums`.

## Legacy Reference

```typescript
// packages/legacy/src/clip/ClipBuilder.ts:59-71
build(): ClipNode {
    return {
        _version: SCHEMA_VERSION,
        kind: 'clip',
        name: this._params.name,
        operations: this._params.chain?.toArray() ?? [],
        tempo: this._params.tempo,
        timeSignature: this._params.timeSignature,
        swing: this._params.swing,
        groove: this._params.groove
    }
}
```

## Required Implementation

1. Define `ClipNode` type in composer types
2. Implement `build()` on `SynapticClip` base class
3. Return structured AST of all operations

## Acceptance Criteria

- [ ] `ClipNode` type defined
- [ ] `build()` method on SynapticClip
- [ ] Returns valid ClipNode with operations, tempo, etc.
- [ ] Tests for build() method
