# Directive: Task 016

## Task
Implement `play(clip)` method for composing clips together.

## Requirements

1. Add `ClipOp` type to `types.ts`
2. Implement `play(clip)` on `SynapticMelody`
3. Insert operations from another clip at current tick position

## Type Definition

Add to `packages/composer/src/types.ts`:

```typescript
export interface ClipOp {
    kind: 'clip';
    clip: ClipNode;
}
```

Update `ClipNode.operations` to accept `(NoteOperation | LoopOp | ClipOp)[]`.

## Implementation

Add to `SynapticMelody`:

```typescript
/**
 * Insert operations from another clip at current tick position.
 * @param clip - Source clip (SynapticMelody or ClipNode)
 */
play(clip: SynapticMelody | ClipNode): this {
    const source = 'build' in clip ? clip.build() : clip;
    
    // Replay each operation at current tick offset
    const tickOffset = this.getCurrentTick();
    for (const op of source.operations) {
        if (op.kind === 'note') {
            this.operations.push({
                ...op,
                tick: op.tick + tickOffset,
                sourceId: this.generateSourceId()
            });
        }
    }
    
    // Advance tick by source clip duration
    const maxTick = source.operations.reduce(
        (max, op) => op.kind === 'note' ? Math.max(max, op.tick + op.duration) : max,
        0
    );
    this.advanceTick(maxTick);
    
    return this;
}
```

## Files

- `packages/composer/src/types.ts` (modify)
- `packages/composer/src/clips/SynapticMelody.ts` (add play method)
- `packages/composer/src/__tests__/play.test.ts` (create)

## Acceptance

- [ ] `ClipOp` type defined
- [ ] `play(clip)` inserts operations at current tick
- [ ] Tick advances by source clip duration
- [ ] Tests pass
- [ ] No TypeScript errors
