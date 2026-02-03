# Directive: Task 018

## Task
Add missing drum hit methods: `openHat()`, `crash()`, `ride()`, `tom()`.

## Requirements

1. Add methods to `SynapticDrumHitCursor` (relays)
2. Add methods to `SynapticDrums` (entry points)
3. Use GM MIDI note numbers

## GM MIDI Drum Map

| Method | Note | Pitch |
|--------|------|-------|
| `openHat()` | A#1 | 46 |
| `crash()` | C#2 | 49 |
| `ride()` | D#2 | 51 |
| `tom(1)` | C2 | 48 |
| `tom(2)` | A1 | 45 |
| `tom(3)` | G1 | 43 |

## Implementation

Add to `SynapticDrumHitCursor`:

```typescript
openHat(duration?: number): this {
    return this.hit(46, duration); // A#1
}

crash(duration?: number): this {
    return this.hit(49, duration); // C#2
}

ride(duration?: number): this {
    return this.hit(51, duration); // D#2
}

tom(which: 1 | 2 | 3 = 1, duration?: number): this {
    const pitches = { 1: 48, 2: 45, 3: 43 }; // C2, A1, G1
    return this.hit(pitches[which], duration);
}
```

Add to `SynapticDrums`:

```typescript
openHat(duration?: number): SynapticDrumHitCursor {
    return this.cursor.openHat(duration);
}

crash(duration?: number): SynapticDrumHitCursor {
    return this.cursor.crash(duration);
}

ride(duration?: number): SynapticDrumHitCursor {
    return this.cursor.ride(duration);
}

tom(which: 1 | 2 | 3 = 1, duration?: number): SynapticDrumHitCursor {
    return this.cursor.tom(which, duration);
}
```

## Files

- `packages/composer/src/cursors/SynapticDrumHitCursor.ts` (add relays)
- `packages/composer/src/clips/SynapticDrums.ts` (add entry points)
- `packages/composer/src/__tests__/SynapticDrums.test.ts` (add tests)

## Acceptance

- [ ] `openHat()` emits pitch 46
- [ ] `crash()` emits pitch 49
- [ ] `ride()` emits pitch 51
- [ ] `tom(1)` emits pitch 48, `tom(2)` = 45, `tom(3)` = 43
- [ ] Cursor chaining: `drums.kick().openHat().commit()`
- [ ] Tests pass
