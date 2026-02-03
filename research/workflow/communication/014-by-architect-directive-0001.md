# Directive: Task 014

## Task
Implement `build()` method on `SynapticClip` to output `ClipNode` structure.

## Requirements

1. Create `packages/composer/src/types.ts` with `ClipNode` type
2. Add `build()` method to `SynapticClip`
3. Track operations during clip construction
4. Return structured AST

## Type Definition

Create `packages/composer/src/types.ts`:

```typescript
export const SCHEMA_VERSION = 1;

export interface ClipNode {
    readonly _version: number;
    kind: 'clip';
    name: string;
    operations: NoteOperation[];
    tempo?: number;
    timeSignature?: [number, number];
    swing?: number;
    groove?: string | null;
}

export interface NoteOperation {
    kind: 'note';
    pitch: number;
    velocity: number;
    duration: number;
    tick: number;
    muted: boolean;
    sourceId: number;
}
```

## Implementation

Add to `SynapticClip`:

1. Add protected field: `protected operations: NoteOperation[] = []`
2. Add protected field: `protected clipName: string = ''`
3. Modify `flushNote()` to also push to `operations` array
4. Add `name(n: string): this` method to set clip name
5. Add `build(): ClipNode` method

## Files

- `packages/composer/src/types.ts` (create)
- `packages/composer/src/clips/SynapticClip.ts` (modify)
- `packages/composer/src/__tests__/build.test.ts` (create)

## Acceptance

- [ ] `ClipNode` type defined in `types.ts`
- [ ] `build()` method returns valid `ClipNode`
- [ ] Operations array populated during note creation
- [ ] Test verifies build output
- [ ] No TypeScript errors
