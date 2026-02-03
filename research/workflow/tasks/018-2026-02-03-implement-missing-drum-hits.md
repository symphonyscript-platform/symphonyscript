# Task 018: Implement Missing Drum Hits

**Priority:** HIGH  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

SynapticDrums is missing several standard drum sounds.

## Current State

Only `kick()`, `snare()`, `hat()`, `clap()`, `hit()` exist.

## Missing Methods

| Method | GM MIDI Note | Purpose |
|--------|--------------|---------|
| `openHat()` | A#1 (46) | Open hi-hat |
| `crash()` | C#2 (49) | Crash cymbal |
| `ride()` | D#2 (51) | Ride cymbal |
| `tom(1)` | C2 (48) | High tom |
| `tom(2)` | A1 (45) | Mid tom |
| `tom(3)` | G1 (43) | Low tom |

## Legacy Reference

```typescript
// packages/legacy/src/clip/DrumBuilder.ts:88-113
openHat(): DrumHitCursor { return this.hit('openhat') }
crash(): DrumHitCursor { return this.hit('crash') }
ride(): DrumHitCursor { return this.hit('ride') }
tom(which: 1 | 2 | 3 = 1): DrumHitCursor { return this.hit(`tom${which}`) }
```

## Required Implementation

1. Add methods to `SynapticDrums`
2. Add relay methods to `SynapticDrumHitCursor`
3. Update drum map with correct pitches

## Acceptance Criteria

- [ ] `openHat()` works
- [ ] `crash()` works
- [ ] `ride()` works
- [ ] `tom(1)`, `tom(2)`, `tom(3)` work
- [ ] Cursor relays work: `drums.kick().openHat().commit()`
- [ ] Tests for all methods
