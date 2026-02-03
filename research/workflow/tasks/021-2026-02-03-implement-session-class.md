# Task 021: Implement Session Class

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No way to manage multiple tracks and effect buses.

## Current State

No `Session` class exists in composer package.

## Legacy Reference

```typescript
// packages/core/src/session/Session.ts
class Session {
    static create(): Session
    
    tempo(bpm: number): Session
    timeSignature(signature: TimeSignatureString): Session
    add(track: Track | TrackNode): Session
    track(name: string, clip, instrument): Session
    bus<T extends EffectType>(id: string, type: T, params): Session
    build(): SessionNode
}

function session(options?): Session
```

## Required Implementation

1. Define `SessionNode` type
2. Implement `Session` class with:
   - Track management (`add()`, `track()`)
   - Effect bus definition (`bus()`)
   - Global tempo/time signature
   - `build()` for output

## Acceptance Criteria

- [ ] `Session.create()` works
- [ ] `session.add(track)` adds tracks
- [ ] `session.bus('reverb', 'reverb', {...})` defines bus
- [ ] `session.tempo(120)` sets global tempo
- [ ] `session.build()` returns SessionNode
- [ ] Tests for Session class
