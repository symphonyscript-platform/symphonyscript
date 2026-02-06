# Implementation Plan: Task 043 - Rename ComposerCursor to SynapticCursor

**Date:** 2026-02-05
**Author:** Symphony-Engineer-Zero
**RFC Reference:** RFC-049 Compliance

---

## Overview

Rename the base cursor class from `ComposerCursor` to `SynapticCursor` per RFC-049 specification. This is a pure refactoring task with no functional changes.

---

## Atomic Tasks

### Task 1: Rename Source File
- Rename `packages/composer/src/cursors/ComposerCursor.ts` → `SynapticCursor.ts`
- Update class name from `ComposerCursor` to `SynapticCursor`
- Update JSDoc comment

### Task 2: Update Cursor Imports
Files requiring import updates:
- `packages/composer/src/cursors/SynapticNoteCursor.ts`
- `packages/composer/src/cursors/SynapticMelodyBaseCursor.ts`
- `packages/composer/src/cursors/SynapticDrumHitCursor.ts`

### Task 3: Update Index Export
- Update `packages/composer/src/index.ts` to export `SynapticCursor` from new path

### Task 4: Update Test File
- Update `packages/composer/src/__tests__/SynapticCursor.test.ts` to import `SynapticCursor`
- Update test descriptions to reference `SynapticCursor`

### Task 5: Clean Up Generated Files
- Delete old `.d.ts` and `.d.ts.map` files:
  - `packages/composer/src/cursors/ComposerCursor.d.ts`
  - `packages/composer/src/cursors/ComposerCursor.d.ts.map`

### Task 6: Verify Build and Tests
- Run TypeScript compilation
- Run all tests to verify no regressions

---

## Files Affected

| File | Change |
|------|--------|
| `cursors/ComposerCursor.ts` | Rename to `SynapticCursor.ts`, rename class |
| `cursors/SynapticNoteCursor.ts` | Update import |
| `cursors/SynapticMelodyBaseCursor.ts` | Update import |
| `cursors/SynapticDrumHitCursor.ts` | Update import |
| `index.ts` | Update export |
| `__tests__/SynapticCursor.test.ts` | Update import and references |
| `cursors/ComposerCursor.d.ts` | Delete (generated) |
| `cursors/ComposerCursor.d.ts.map` | Delete (generated) |

---

## Verification

- [ ] All imports resolve correctly
- [ ] TypeScript compilation succeeds
- [ ] All existing tests pass
- [ ] No functional changes introduced
