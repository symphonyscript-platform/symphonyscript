# Directive: Task 017

## Task
Implement octave methods: `octave()`, `octaveUp()`, `octaveDown()`.

## Requirements

1. Add `octave(n)` to `SynapticClip` — sets absolute octave (4 = middle C, octave 5 = +12 semitones)
2. Add `octaveUp(n)` to `SynapticClip` — shifts up by `n * 12` semitones
3. Add `octaveDown(n)` to `SynapticClip` — shifts down by `n * 12` semitones
4. Add escape methods to `ComposerCursor` for cursor-level access

## Implementation

Add to `SynapticClip`:

```typescript
/**
 * Set absolute octave context.
 * @param n - Octave number (4 = middle C, 5 = one octave up)
 */
octave(n: number): this {
    this.transposeOffset = (n - 4) * 12;
    return this;
}

/**
 * Shift up by n octaves.
 * @param n - Number of octaves (default 1)
 */
octaveUp(n: number = 1): this {
    this.transposeOffset += n * 12;
    return this;
}

/**
 * Shift down by n octaves.
 * @param n - Number of octaves (default 1)
 */
octaveDown(n: number = 1): this {
    this.transposeOffset -= n * 12;
    return this;
}
```

Add escapes to `ComposerCursor`:

```typescript
octave(n: number): SynapticClip {
    this._commit();
    return this.clip.octave(n);
}

octaveUp(n: number = 1): SynapticClip {
    this._commit();
    return this.clip.octaveUp(n);
}

octaveDown(n: number = 1): SynapticClip {
    this._commit();
    return this.clip.octaveDown(n);
}
```

## Files

- `packages/composer/src/clips/SynapticClip.ts` (add methods)
- `packages/composer/src/cursors/ComposerCursor.ts` (add escapes)
- `packages/composer/src/__tests__/octave.test.ts` (create)

## Acceptance

- [ ] `octave(5)` sets transpose to +12
- [ ] `octave(3)` sets transpose to -12
- [ ] `octaveUp(2)` adds +24 to transpose
- [ ] `octaveDown(1)` adds -12 to transpose
- [ ] Cursor escapes work
- [ ] Tests pass
