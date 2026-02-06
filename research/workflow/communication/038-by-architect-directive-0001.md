# Directive: Task 038

Implement `freeze()` for incremental compilation per `research/workflow/tasks/038-2026-02-03-implement-freeze.md`

## Expectations

- Create `FrozenClip` class in `packages/composer/src/clips/FrozenClip.ts`:
  ```typescript
  export class FrozenClip {
      constructor(
          public readonly clipNode: ClipNode,
          public readonly options: FreezeOptions
      ) {}
  }
  ```
- Add `FreezeOptions` interface to `types.ts`:
  ```typescript
  interface FreezeOptions {
      bpm?: number;
      // Add other compile options as needed
  }
  ```
- Implement `freeze(options?: FreezeOptions): FrozenClip` on SynapticClip
- Add `play(frozenClip: FrozenClip): this` overload to SynapticClip
- `play(FrozenClip)` should inline the frozen clip's operations
- Export `FrozenClip` and `FreezeOptions` from index.ts

## Files

- `packages/composer/src/clips/FrozenClip.ts` (create)
- `packages/composer/src/types.ts` (add FreezeOptions)
- `packages/composer/src/clips/SynapticClip.ts` (add freeze, update play)
- `packages/composer/src/index.ts` (export)
- `packages/composer/src/__tests__/Freeze.test.ts` (create)
