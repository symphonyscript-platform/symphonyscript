# Directive: Task 046

Implement `toOperations()` and `OperationsSource` interface in the composer package.

## Context

Legacy reference: `OperationsSource<B>` is the interface that `loop()` uses to accept both clips and frozen clips as content sources.

## Requirements

1. Add to `packages/composer/src/types.ts`:
   ```typescript
   interface OperationsSource {
       toOperations(): (NoteOperation | CCOperation | ...)[];
   }
   ```
2. Implement `toOperations()` on `SynapticClip` — returns current operations array (snapshot)
3. Implement `toOperations()` on `FrozenClip` — returns frozen operations
4. Add cursor escape for `toOperations()` on `SynapticCursor`
5. Update `loop()` and `play()` to accept `OperationsSource` in addition to existing types
6. Export `OperationsSource` from index.ts

## Acceptance Criteria

- [ ] `OperationsSource` interface exists
- [ ] `SynapticClip.toOperations()` works
- [ ] `FrozenClip.toOperations()` works
- [ ] `loop()` / `play()` accept `OperationsSource`
- [ ] Tests created
- [ ] Build and tests pass
