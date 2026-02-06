# Directive: Task 043

Rename `ComposerCursor` to `SynapticCursor` per `research/workflow/tasks/043-2026-02-03-rename-composer-cursor.md`

## Expectations

- Rename file: `ComposerCursor.ts` → `SynapticCursor.ts`
- Rename class: `ComposerCursor` → `SynapticCursor`
- Update all imports across composer package
- Update index.ts export
- Update all test files referencing ComposerCursor
- No functional changes

## Files

- `packages/composer/src/cursors/ComposerCursor.ts` → `SynapticCursor.ts`
- `packages/composer/src/cursors/*.ts` (update imports)
- `packages/composer/src/clips/*.ts` (update imports)
- `packages/composer/src/index.ts` (update export)
- `packages/composer/src/__tests__/*.ts` (update references)
