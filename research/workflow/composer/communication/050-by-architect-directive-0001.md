# Directive: Task 050

## Task
Extract `SCALE_INTERVALS` constant to shared location, eliminating DRY violation.

## Requirements

1. Create `packages/composer/src/utils/scales.ts`
2. Move `SCALE_INTERVALS` to this file as `Object.freeze()` immutable export
3. Type as `Record<ScaleMode, readonly number[]>` with frozen inner arrays
4. Update `clips/SynapticMelody.ts` to import from `utils/scales`
5. Update `cursors/SynapticMelodyNoteCursor.ts` to import from `utils/scales`
6. Delete duplicate definitions and duplication comments

## Files

- `[NEW] packages/composer/src/utils/scales.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticMelodyNoteCursor.ts`

## Acceptance Criteria

- [ ] `SCALE_INTERVALS` exists in exactly one location: `utils/scales.ts`
- [ ] Constant is deeply frozen (outer object + inner arrays)
- [ ] Both consumer files import from `utils/scales`
- [ ] No circular dependency introduced
- [ ] All existing tests pass (`nx test composer`)
- [ ] Build succeeds (`nx build composer`)
