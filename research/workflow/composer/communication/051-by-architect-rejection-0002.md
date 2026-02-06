# Rejection: Task 051

## Issues

### 1. Math.random() in Hot Path
- Location: `SynapticChordCursor.ts:171`
- Problem: Uses `Math.random()` for 'random' arpeggio pattern
- Required: Use seeded RNG from clip (`this.clip.getHumanizeRng()` or pass seed)

```typescript
// CURRENT (FORBIDDEN)
const j = Math.floor(Math.random() * (i + 1));

// REQUIRED (use clip's seeded RNG)
const rng = this.clip.getSeededRng();
const j = Math.floor(rng.next() * (i + 1));
```

The `SynapticMelody.applyArpPattern()` correctly uses `SeededRandom` — chord cursor must do the same.

## Action

1. Expose `getSeededRng(): SeededRandom` on `SynapticClip`
2. Use it in `SynapticChordCursor.applyArpPattern()` for 'random' pattern
3. Alternatively, accept optional `seed` parameter like melody version

Fix and resubmit.
