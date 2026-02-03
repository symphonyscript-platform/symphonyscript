# Task 020: Implement Track Class

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to associate clips with instruments and effects.

## Current State

No `Track` class exists in composer package.

## Legacy Reference

```typescript
// packages/core/src/session/Track.ts
class Track {
    constructor(
        instrument: Instrument,
        clipSource: ClipBuilder<any> | ClipNode,
        name?: string,
        // ...
    )

    tempo(bpm: number): Track
    timeSignature(signature: TimeSignatureString): Track
    insert<T extends EffectType>(type: T, params: EffectParamsFor<T>): Track
    send(busId: string, amount: number): Track
    build(): TrackNode

    static from(clip, instrument, options?): Track
}
```

## Required Implementation

1. Define `TrackNode` type
2. Implement `Track` class with:
   - Constructor taking instrument + clip
   - `tempo()`, `timeSignature()` fluent methods
   - `insert()` for adding effects
   - `send()` for bus routing
   - `build()` for output

## Acceptance Criteria

- [ ] `Track.from(clip, instrument)` works
- [ ] `track.tempo(120).timeSignature('4/4')` chains
- [ ] `track.insert('reverb', { mix: 0.3 })` works
- [ ] `track.send('delay-bus', 0.5)` works
- [ ] `track.build()` returns TrackNode
- [ ] Tests for Track class
