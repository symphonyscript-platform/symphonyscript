# Directive: Task 032

Implement quantize per `research/workflow/tasks/032-2026-02-03-implement-quantize.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  interface QuantizeSettings {
      grid: number;        // Grid size in beats (e.g., 0.25 = 16th notes)
      strength?: number;   // 0-1, how much to snap (default: 1 = full snap)
      duration?: boolean;  // Also quantize duration (default: false)
  }
  ```
- Add `_quantizeSettings: QuantizeSettings | null` to SynapticClip
- Add `quantize(grid, options?): this` escape method
- Grid is numeric (beats), not string notation
- Apply in `flushNote()` pipeline order: Quantize → Groove → Humanize
- Strength interpolates: `finalTick = originalTick + (snappedTick - originalTick) * strength`

## Files

- `packages/composer/src/types.ts` (add QuantizeSettings)
- `packages/composer/src/clips/SynapticClip.ts` (add state, method, apply in flushNote)
- `packages/composer/src/index.ts` (export QuantizeSettings)
- `packages/composer/src/__tests__/Quantize.test.ts` (create)
