# Task 028: Implement Euclidean Rhythm Generator

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No algorithmic rhythm generation.

## Current State

No `euclidean()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:599-638
euclidean(options: EuclideanMelodyOptions): this {
    const { hits, steps, notes, stepDuration, velocity, rotation, repeat } = options
    
    let pattern = euclidean(hits, steps)
    if (rotation !== 0) {
        pattern = rotatePattern(pattern, rotation)
    }
    
    for (let r = 0; r < repeat; r++) {
        for (const isHit of pattern) {
            if (isHit) {
                builder = builder.note(notes[noteIndex % notes.length], stepDuration)
                    .velocity(velocity).commit()
                noteIndex++
            } else {
                builder = builder.rest(stepDuration)
            }
        }
    }
}
```

## Required Implementation

1. Implement `euclidean(options)` on SynapticMelody
2. Implement `euclidean(options)` on SynapticDrums
3. Add escape method to cursors

## Example

```typescript
// Melody euclidean
melody.euclidean({
    hits: 5,
    steps: 8,
    notes: ['C4', 'E4', 'G4'],
    stepDuration: '16n',
    repeat: 4
})

// Drum euclidean
drums.euclidean({
    hits: 3,
    steps: 8,
    note: 'kick',
    stepDuration: '8n'
})
```

## Acceptance Criteria

- [ ] `euclidean()` on melody works
- [ ] `euclidean()` on drums works
- [ ] Rotation parameter works
- [ ] Repeat parameter works
- [ ] Tests for euclidean patterns
