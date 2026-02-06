# Task 050: Extract SCALE_INTERVALS to Shared Location

**Priority:** LOW  
**Category:** DRY Violation  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit M-001

---

## Problem

`SCALE_INTERVALS` constant is duplicated in two files with explicit comment admitting duplication.

## Current State

```typescript
// clips/SynapticMelody.ts:16-25
/**
 * Scale intervals for degree-to-pitch conversion.
 * Duplicated from SynapticMelodyNoteCursor to avoid circular dependency.
 */
const SCALE_INTERVALS: Record<ScaleMode, number[]> = { ... };

// cursors/SynapticMelodyNoteCursor.ts:9-17
const SCALE_INTERVALS: Record<ScaleMode, number[]> = { ... };
```

## Required Implementation

1. Create `utils/scales.ts`
2. Export `SCALE_INTERVALS` as frozen constant
3. Update both files to import from shared location

## Files to Modify

- `[NEW] packages/composer/src/utils/scales.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`
- `[MODIFY] packages/composer/src/cursors/SynapticMelodyNoteCursor.ts`

## Acceptance Criteria

- [ ] `SCALE_INTERVALS` exists in single location
- [ ] Both files import from `utils/scales`
- [ ] All existing scale tests pass
- [ ] No circular dependency introduced
