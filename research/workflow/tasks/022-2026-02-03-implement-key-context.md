# Task 022: Implement Key Signature Context

**Priority:** MEDIUM  
**Category:** Missing Feature  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - Feature Gap

---

## Problem

No automatic accidentals based on key signature.

## Current State

No `key()` method exists. Users must manually add sharps/flats.

## Legacy Reference

```typescript
// packages/legacy/src/clip/MelodyBuilder.ts:109-139
key(root: ChordRoot, mode: 'major' | 'minor'): this {
    return this._withParams({
        keyContext: { root, mode }
    })
}

accidental(acc: Accidental): this {
    return this._withParams({
        nextAccidental: acc
    })
}
```

## Required Implementation

1. Add `KeyContext` type
2. Add `keyContext` to SynapticMelody state
3. Implement `key(root, mode)` method
4. Implement `accidental(acc)` for single-note override
5. Auto-apply accidentals in `note()` based on key

## Example

```typescript
melody
    .key('G', 'major')
    .note('F4')      // Becomes F#4 (G major has F#)
    .accidental('natural')
    .note('F4')      // F natural (override)
    .note('F4')      // F#4 again (accidental consumed)
```

## Acceptance Criteria

- [ ] `key('G', 'major')` sets context
- [ ] Notes auto-adjusted per key signature
- [ ] `accidental('natural')` overrides for next note
- [ ] `accidental('sharp')`, `accidental('flat')` work
- [ ] Tests for key context
