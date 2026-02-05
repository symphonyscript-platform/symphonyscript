# Directive: Task 031

Implement defaultHumanize per `research/workflow/tasks/031-2026-02-03-implement-humanize-context.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  interface HumanizeSettings {
      timing?: number;    // Max timing offset in ms (default: 0)
      velocity?: number;  // Max velocity variation (0-1, default: 0)
      seed?: number;      // For reproducible humanization
  }
  ```
- Add `_humanizeSettings: HumanizeSettings | null` to SynapticClip
- Add `defaultHumanize(settings): this` escape method
- Modify `applyHumanization()` to use settings (timing + velocity)
- Add `precise(): this` to cursor to flag note should skip humanization
- Track `_precise` flag in cursor, consumed by `commit()`

## Notes

- Existing `humanizeRng` in SynapticClip already exists - reinitialize with seed if provided
- `timing` variation should be applied in `applySwing()` (or separate method)
- `velocity` variation already exists in `applyHumanization()` - make it configurable

## Files

- `packages/composer/src/types.ts` (add HumanizeSettings)
- `packages/composer/src/clips/SynapticClip.ts` (add state, methods, modify applyHumanization)
- `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts` (add precise())
- `packages/composer/src/cursors/SynapticDrumHitCursor.ts` (add precise())
- `packages/composer/src/index.ts` (export HumanizeSettings)
- `packages/composer/src/__tests__/Humanize.test.ts` (create)
