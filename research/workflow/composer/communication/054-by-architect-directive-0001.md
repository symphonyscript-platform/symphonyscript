# Directive: Task 054

## Task
Implement loop region support in `ClipNode` and `SynapticClip`.

## Requirements

1.  **Update `ClipNode` in `types.ts`**:
    *   Add `loopRegion` optional field:
        ```typescript
        loopRegion?: {
            start: number;
            end: number;
            enabled: boolean;
        };
        ```

2.  **Update `SynapticClip.build()` in `SynapticClip.ts`**:
    *   Populate `loopRegion` if `this.loopEnabled` is true.

3.  **Update `MockConsumer` in `packages/kernel/src/mock-consumer.ts`**:
    *   Implement loop logic in playback loop (this is a test utility, ensure it respects loop region).

## Files

- `[MODIFY] packages/composer/src/types.ts`
- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/kernel/src/mock-consumer.ts`
- `[NEW] packages/composer/src/__tests__/LoopRegion.test.ts`

## Acceptance Criteria

- [ ] `ClipNode` has `loopRegion` type.
- [ ] `build()` includes loop data when enabled.
- [ ] `setLoopRegion(0, 480)` results in valid `loopRegion` object.
- [ ] `LoopRegion.test.ts` verifies correct structure and mock playback looping.
