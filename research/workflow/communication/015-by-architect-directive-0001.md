# Directive: Task 015

## Task
Implement `loop(count, content)` method for repeating sequences.

## Conflict Resolution
Current `SynapticClip.loop(start, end)` sets loop boundaries for playback. Task 015 requires `loop(count, content)` for compositional repetition.

**Decision:** Rename existing method to `setLoopRegion(start, end)`. Implement new `loop(count, content)`.

## Requirements

1. Rename `loop(start, end)` to `setLoopRegion(start, end)` in `SynapticClip`
2. Add `LoopOp` type to `types.ts`
3. Implement `loop(count, builderFn)` on `SynapticMelody`
4. Builder function receives a fresh clip, operations are replayed `count` times

## Type Definition

Add to `packages/composer/src/types.ts`:

```typescript
export interface LoopOp {
    kind: 'loop';
    count: number;
    operations: NoteOperation[];
}
```

Update `ClipNode.operations` to accept `(NoteOperation | LoopOp)[]`.

## Implementation

Add to `SynapticMelody`:

```typescript
loop(count: number, builderFn: (clip: SynapticMelody) => void): this {
    for (let i = 0; i < count; i++) {
        builderFn(this);
    }
    return this;
}
```

## Files

- `packages/composer/src/types.ts` (modify)
- `packages/composer/src/clips/SynapticClip.ts` (rename loop → setLoopRegion)
- `packages/composer/src/clips/SynapticMelody.ts` (add loop method)
- `packages/composer/src/__tests__/loop.test.ts` (create)

## Acceptance

- [ ] `setLoopRegion(start, end)` replaces old `loop(start, end)`
- [ ] `loop(count, fn)` executes builder function `count` times
- [ ] Operations are recorded for each iteration
- [ ] Tests pass
- [ ] No TypeScript errors
