# Task 029: Implement Arpeggio

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No arpeggiator for chord notes.

## Current State

No `arpeggio()` method exists.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:266-384
arpeggio(pitches: NoteName[], rate: NoteDuration, options?: {
    pattern?: ArpPattern;  // 'up' | 'down' | 'upDown' | 'random' | etc.
    velocity?: number;
    gate?: number;
    octaves?: number;
    seed?: number
}): this
```

## Required Implementation

1. Define `ArpPattern` type
2. Implement `arpeggio(pitches, rate, options)` on SynapticMelody
3. Support patterns: up, down, upDown, downUp, random, converge, diverge
4. Support multi-octave expansion

## Example

```typescript
melody.arpeggio(['C4', 'E4', 'G4'], '16n', {
    pattern: 'upDown',
    octaves: 2,
    velocity: 0.8,
    gate: 0.8
})
```

## Acceptance Criteria

- [ ] `arpeggio()` plays notes sequentially
- [ ] Pattern 'up' works (ascending)
- [ ] Pattern 'down' works (descending)
- [ ] Pattern 'upDown' works
- [ ] Pattern 'random' with seed works
- [ ] Multi-octave expansion works
- [ ] Tests for arpeggio
