# Task 041: Implement degreeChord()

**Priority:** LOW  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to create chords using scale degrees.

## Current State

No `degreeChord()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:422-433
degreeChord(degrees: number[], duration: NoteDuration = '4n'): MelodyChordCursor {
    const ctx = this._params.scaleContext
    if (!ctx) {
        throw new Error('degreeChord() requires scale() to be called first')
    }
    
    const notes = degrees.map(deg => degreeToNote(deg, ctx) as NoteName)
    return this.chord(notes, duration)
}
```

## Required Implementation

1. Implement `degreeChord(degrees, duration)` on SynapticMelody
2. Requires `scale()` context (Task 019)
3. Returns chord cursor

## Example

```typescript
melody
    .scale('C', 'major')
    .degreeChord([1, 3, 5], '2n').commit()  // C major triad
    .degreeChord([2, 4, 6], '2n').commit()  // D minor triad
```

## Acceptance Criteria

- [ ] `degreeChord([1,3,5])` creates triad
- [ ] Requires scale() context
- [ ] Returns SynapticChordCursor
- [ ] Works with all scale modes
- [ ] Tests for degree chords
