# Directive: Task 055

## Task
Add allocation policy documentation to `SynapticClip` class.

## Requirements

1.  Locate `SynapticClip` class definition in `packages/composer/src/clips/SynapticClip.ts`.
2.  Add class-level JSDoc explaining:
    *   **Allocation Policy:** Runs on main thread only. Maps/Arrays permitted.
    *   **"KERNEL-SAFE" definition:** Refers to output format compatibility, NOT thread safety.
    *   **Clarification:** Actual audio-thread-safe operations are in `@symphonyscript/kernel`.

## Files

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`

## Acceptance Criteria

- [ ] Class JSDoc clearly explains allocation policy and "KERNEL-SAFE" meaning.
- [ ] No code changes.
