# Task 017: Implement Octave Methods

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No convenient way to shift octaves.

## Current State

Only `transpose(semitones)` exists. Users must calculate `transpose(12)` manually.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:78-100
octave(n: number): this {
    const semitones = (n - 4) * 12
    return this._withParams({ transposition: semitones })
}

octaveUp(n: number = 1): this {
    return this.transpose(n * 12)
}

octaveDown(n: number = 1): this {
    return this.transpose(-n * 12)
}
```

## Required Implementation

1. Add `octave(n)` - set absolute octave (4 = middle C)
2. Add `octaveUp(n)` - shift up n octaves
3. Add `octaveDown(n)` - shift down n octaves
4. Add to both SynapticMelody and SynapticMelodyNoteCursor (escape)

## Acceptance Criteria

- [ ] `octave(5)` sets octave 5 context
- [ ] `octaveUp(2)` shifts up 24 semitones
- [ ] `octaveDown(1)` shifts down 12 semitones
- [ ] Works as escape on cursor
- [ ] Tests for all methods
