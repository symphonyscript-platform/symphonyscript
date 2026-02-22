# Task 069: Mark Session/Track as Design-Time Builders

**Priority:** HIGH  
**Category:** Documentation / Architecture  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan - Gap Analysis

---

## Problem

`Session.ts` and `Track.ts` use arrays and object allocations:
- `tracks: TrackNode[] = []`
- `buses: EffectBusConfig[] = []`
- `insertEffects: InsertEffect[] = []`
- `build()` returns object literals

These are NOT in the hot path (they're called once during session setup), but they're not documented as such.

## Current State

```typescript
// Session.ts
private readonly tracks: TrackNode[] = [];
private readonly buses: EffectBusConfig[] = [];

add(track: Track | TrackNode): this {
    this.tracks.push(trackNode);  // Array mutation
    return this;
}

build(): SessionNode {
    return {
        tracks: [...this.tracks],  // Object + array spread
        buses: [...this.buses],
    };
}
```

## Required Implementation

Since these are design-time builders (called once to set up a session, not during playback), the correct action is to:

1. **Document** clearly with `@design-time` JSDoc tag
2. **Add** runtime guard to prevent hot-path misuse

```typescript
/**
 * Session class for managing multiple tracks and effect buses.
 * 
 * @design-time This class is intended for session setup only.
 * Do not call Session methods during playback hot paths.
 * Allocations are acceptable during design-time.
 */
export class Session {
    // ...
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/Session.ts` (add documentation)
- `[MODIFY] packages/composer/src/Track.ts` (add documentation)

## Dependencies

- None

## Acceptance Criteria

- [ ] `Session` class has `@design-time` JSDoc documentation
- [ ] `Track` class has `@design-time` JSDoc documentation
- [ ] README updated to clarify design-time vs runtime distinction
- [ ] No code changes needed (documentation only)
- [ ] `pnpm build` passes; `pnpm test` passes **excluding** pre-existing `SynapticChordCursor` allocation smoke test (addressed in task 061)
