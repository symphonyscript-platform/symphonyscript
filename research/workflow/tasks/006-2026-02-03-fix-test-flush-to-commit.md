# Task 006: Fix flush() to commit() in Test Files

**Priority:** CRITICAL  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Multiple test files call `cursor.flush()` but the actual method is `cursor.commit()`.

## Locations

| File | Line | Call |
|------|------|------|
| `SynapticNoteCursor.test.ts` | 76 | `cursor.flush()` |
| `SynapticChordCursor.test.ts` | 42 | `cursor.flush()` |
| `SynapticChordCursor.test.ts` | 53 | `cursor.flush()` |
| `SynapticChordCursor.test.ts` | 66 | `cursor.flush()` |
| `SynapticChordCursor.test.ts` | 101 | `pureCursor.flush()` |
| `SynapticMelodyNoteCursor.test.ts` | 95 | `cursor.flush()` |

## Evidence

```
TypeError: cursor.flush is not a function

    > 76 |         cursor.flush();
         |                ^
```

## Impact

- 6 tests fail with TypeError
- Cursor functionality not tested

## Remediation

Replace all `flush()` calls with `commit()`:

```typescript
// Before
cursor.flush();

// After
cursor.commit();
```

## Files to Update

1. `packages/composer/src/__tests__/SynapticNoteCursor.test.ts`
2. `packages/composer/src/__tests__/SynapticChordCursor.test.ts`
3. `packages/composer/src/__tests__/SynapticMelodyNoteCursor.test.ts`

## Acceptance Criteria

- [ ] No `flush()` calls remain in test files
- [ ] All `flush()` replaced with `commit()`
- [ ] Tests pass (or fail for legitimate reasons)
