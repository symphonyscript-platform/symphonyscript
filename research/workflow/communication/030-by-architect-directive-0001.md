# Directive: Task 030

Implement defaultDuration per `research/workflow/tasks/030-2026-02-03-implement-default-duration.md`

## Expectations

- Add `_defaultDuration: number | null` to SynapticClip state (default: null, meaning 1 beat)
- Add `defaultDuration(duration: number): this` escape method to SynapticClip
- Cursors use `clip.getDefaultDuration()` when duration not specified in `note()`
- If default is null, fall back to 1 (one beat)
- Duration parameter in `note('C4', duration)` always overrides default
- Export `getDefaultDuration()` accessor

## Files

- `packages/composer/src/clips/SynapticClip.ts` (add state + method + accessor)
- `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts` (use default in note())
- `packages/composer/src/__tests__/DefaultDuration.test.ts` (create)
