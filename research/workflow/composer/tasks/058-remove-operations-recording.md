# Task 058: Remove Operations Recording

## Goal
Remove the `operations` array and all `.push()` calls from `SynapticClip` to eliminate allocation of operation objects during playback.

## Proposed APIs / Data Structures
- Remove `protected operations: ... = [];`
- Remove `toOperations()`.
- Remove `build()`.

## Implementation Steps
1. Delete `operations` property from `SynapticClip.ts`.
2. Remove all `this.operations.push(...)` calls in `flushNote`, `tempo`, etc.
3. Remove `toOperations()` and `build()` methods.
4. Update/Remove `preview()` as it relies on `build()`.
5. Update `FrozenClip` if it relies on `ClipNode` structure (may need refactoring to store serialized kernel buffer instead, or be removed if unused).

## Acceptance Criteria
- [ ] `SynapticClip` has no `operations` array.
- [ ] `flushNote` does not allocate any objects.
- [ ] Tests calling `build()` or `toOperations()` are updated or removed.
