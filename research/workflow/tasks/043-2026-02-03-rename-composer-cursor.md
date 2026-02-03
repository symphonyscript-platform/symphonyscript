# Task 043: Consider Renaming ComposerCursor to SynapticCursor

**Priority:** LOW  
**Category:** RFC Compliance  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit - RFC-049 Deviation

---

## Problem

RFC-049 specifies base cursor class as `SynapticCursor`, but implementation uses `ComposerCursor`.

## Current State

```
ComposerCursor (abstract base)  ← Current name
├── SynapticNoteCursor
├── SynapticMelodyBaseCursor
│   ├── SynapticMelodyNoteCursor
│   └── SynapticChordCursor
└── SynapticDrumHitCursor
```

## RFC-049 Specifies

```
SynapticCursor (abstract base)  ← RFC name
├── SynapticNoteCursor
├── ...
```

## Impact

- Low - internal naming doesn't affect external API
- Tests reference `ComposerCursor` (after Task 004 fix)
- Documentation may be inconsistent

## Options

**Option A:** Rename to `SynapticCursor` (matches RFC)
- Update file: `ComposerCursor.ts` → `SynapticCursor.ts`
- Update all imports

**Option B:** Update RFC-049 to use `ComposerCursor`
- Document the deviation
- Keep code as-is

**Recommendation:** Option A for consistency with RFC, but low priority.

## Acceptance Criteria (if proceeding)

- [ ] File renamed to `SynapticCursor.ts`
- [ ] Class renamed to `SynapticCursor`
- [ ] All imports updated
- [ ] Tests updated
- [ ] RFC-049 verified
