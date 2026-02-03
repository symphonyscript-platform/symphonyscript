# Task 019: Implement Scale Context

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

`degree()` is hardcoded to C major. No way to set scale context.

## Current State

```typescript
// Current degree() in SynapticMelody - hardcoded
degree(deg: number): SynapticMelodyNoteCursor {
    const pitch = 60 + [0, 2, 4, 5, 7, 9, 11][(deg - 1) % 7]; // C major only
    return this.note(pitch);
}
```

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:388-417
scale(root: ChordRoot, mode: ScaleMode, octave: number = 4): this {
    return this._withParams({
        scaleContext: { root, mode, octave }
    })
}

degree(deg: number, duration: NoteDuration = '4n', options?: {...}): MelodyNoteCursor {
    const ctx = this._params.scaleContext
    if (!ctx) throw new Error('degree() requires scale() to be called first')
    const note = degreeToNote(deg, ctx, options?.alteration, options?.octaveOffset)
    return this.note(note, duration)
}
```

## Required Implementation

1. Add `ScaleContext` type
2. Add `scaleContext` to SynapticMelody state
3. Implement `scale(root, mode, octave)` method
4. Update `degree()` to use scale context
5. Support alterations and octave offsets

## Acceptance Criteria

- [ ] `scale('G', 'major')` sets context
- [ ] `degree(1)` returns root note in current scale
- [ ] `degree(3)` returns third of scale (major/minor)
- [ ] `degree(1, '4n', { octaveOffset: 1 })` works
- [ ] Error thrown if degree() called without scale()
- [ ] Tests for scale context
