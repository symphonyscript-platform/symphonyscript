# Task 051: Implement Arpeggio Two-Level System

**Priority:** HIGH  
**Category:** Dead Code Fix  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit C-001

---

## Problem

`arpeggio()` method stores state but never consumes it. Users call the method expecting arpeggiation, but chords play as block chords.

## Current State

```typescript
// clips/SynapticClip.ts:361-364
arpeggio(pattern: string): this {
    this.arpeggioPattern = pattern;  // NEVER READ
    return this;
}
```

## Required Implementation

### Clip-Level (Downstream Mode)

```typescript
// SynapticClip.ts
arpeggio(pattern: ArpPattern | null): this
arpeggioRate(rate: number): this
arpeggioGate(gate: number): this
getArpeggioPattern(): ArpPattern | null
getArpeggioRate(): number
getArpeggioGate(): number
```

### Chord-Level (Per-Chord Override)

```typescript
// SynapticChordCursor.ts
arpeggio(pattern: ArpPattern | null): this
arpeggioRate(rate: number): this
arpeggioGate(gate: number): this
```

### Commit Logic

```typescript
// SynapticChordCursor.commit()
const pattern = this._arpPattern ?? this.clip.getArpeggioPattern();
if (pattern !== null) {
    // Emit notes sequentially with ordering
} else {
    // Emit block chord
}
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticChordCursor.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticMelodyNoteCursor.ts`

## Acceptance Criteria

- [ ] `clip.arpeggio('up')` affects subsequent chords
- [ ] `clip.arpeggioRate(0.125)` sets rate
- [ ] `clip.arpeggioGate(0.8)` sets gate
- [ ] `chord().arpeggio('down')` overrides clip-level
- [ ] `arpeggio(null)` disables arpeggiation
- [ ] Pattern 'up' emits ascending order
- [ ] Pattern 'down' emits descending order
- [ ] Pattern 'upDown', 'downUp', 'random', 'converge', 'diverge' work
- [ ] Existing `Arpeggio.test.ts` updated and passing
