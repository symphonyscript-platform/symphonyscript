# Directive: Task 040

Implement custom drum mapping per `research/workflow/tasks/040-2026-02-03-implement-custom-drum-map.md`

## Expectations

- Add `DrumMap` type to `types.ts`:
  ```typescript
  type DrumMap = Record<string, string | number>;  // name -> pitch
  ```
- Add `protected _drumMap: DrumMap` to SynapticDrums (default GM map)
- Implement `withMapping(mapping: DrumMap): this` on SynapticDrums
- Merges with existing map (override existing, add new)
- Update `hit()` and drum methods to resolve from `_drumMap`
- Export `DrumMap` from index.ts

## Files

- `packages/composer/src/types.ts` (add DrumMap type)
- `packages/composer/src/clips/SynapticDrums.ts` (add _drumMap, withMapping)
- `packages/composer/src/index.ts` (export)
- `packages/composer/src/__tests__/DrumMap.test.ts` (create)
