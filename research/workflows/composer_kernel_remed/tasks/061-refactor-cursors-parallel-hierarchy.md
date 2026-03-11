# Task 061: Refactor Cursors to Parallel Hierarchy

**Priority:** HIGH  
**Category:** Zero-Allocation Architecture  
**Status:** Done  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

Current cursors:
1. Call `clip.flushNote()` which pushes to `operations[]` (allocation violation)
2. Don't implement the escape method pattern (implicit commit + delegate)
3. Hierarchy doesn't match the parallel structure needed for different Clip types

## Current State

```typescript
// SynapticMelodyNoteCursor.ts
commit(): SynapticMelody {
    if (!this.pending) return this.clip;
    this.clip.flushNote(...);  // ❌ Pushes to operations[]
    this.reset();
    return this.clip;
}
```

## Required Implementation

### 1. Create Base Cursor with Common Modifiers

```typescript
// BaseNoteCursor.ts
export abstract class BaseNoteCursor<TClip extends SynapticClip> {
    protected clip: TClip;
    protected _pitch: number = 0;
    protected _velocity: number = 1.0;
    protected _duration: number = 0.25;
    protected pending: boolean = false;

    // Modifiers (stay on cursor)
    velocity(v: number): this { this._velocity = v; return this; }
    staccato(): this { this._duration *= 0.5; return this; }
    legato(): this { this._duration *= 1.2; return this; }

    // Force subclasses to implement escape
    protected abstract commit(): void;
}
```

### 2. Create Clip-Specific Cursors

```typescript
// MelodyNoteCursor.ts
export class MelodyNoteCursor extends BaseNoteCursor<SynapticMelody> {
    // Escape methods (commit + delegate)
    note(pitch: number): MelodyNoteCursor {
        this.commit();
        return this.clip.note(pitch);
    }
    
    chord(symbol: string): ChordCursor {
        this.commit();
        return this.clip.chord(symbol);
    }
    
    rest(duration: number): SynapticMelody {
        this.commit();
        return this.clip.rest(duration);
    }
    
    protected commit(): void {
        if (!this.pending) return;
        // Direct to Kernel - NO operations.push()
        this.clip.bridge.insertAsync(...);
        this.reset();
    }
}
```

### 3. Update Clip Classes

```typescript
// SynapticMelody.ts
private readonly _noteCursor: MelodyNoteCursor;

note(pitch: number): MelodyNoteCursor {
    return this._noteCursor.init(pitch);
}
```

## Files to Modify

- `[NEW] packages/composer/src/cursors/BaseNoteCursor.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticMelodyNoteCursor.ts` → `MelodyNoteCursor.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticDrumHitCursor.ts` → `DrumsHitCursor.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticChordCursor.ts` → `MelodyChordCursor.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/clips/SynapticDrums.ts`

## Dependencies

- **Depends on:** Task 058 (Operations array must be removed first)
- **Depends on:** Task 060 (Kernel backpressure must be in place)

## Acceptance Criteria

- [x] `BaseNoteCursor<TClip>` exists with common modifiers
- [x] Each Clip type has a corresponding Cursor type
- [x] All escape methods implement `commit() + delegate` pattern
- [x] Cursors write directly to Kernel via `bridge.insertAsync()`
- [x] No `operations.push()` calls anywhere in cursor code
- [x] Singleton cursor instance per Clip
- [x] `pnpm build && pnpm test` passes
