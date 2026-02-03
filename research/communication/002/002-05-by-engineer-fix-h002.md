# H-002: Update ISiliconLinker Interface Return Type Fix

**Fix ID:** H-002
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

The `ISiliconLinker` interface declared `idTableInsert()` as returning `void`, but the implementation in `SiliconSynapse` returns `boolean` (true if inserted, false if table full). This type mismatch could lead to TypeScript errors when using the interface.

## Files Changed

- `packages/kernel/src/types.ts`

## Changes Made

### `ISiliconLinker.idTableInsert()` (line 144-145)

**Before:**
```typescript
/** Insert sourceId → ptr mapping. */
idTableInsert(sourceId: number, ptr: NodePtr): void
```

**After:**
```typescript
/** Insert sourceId → ptr mapping. Returns true if inserted, false if table full. */
idTableInsert(sourceId: number, ptr: NodePtr): boolean
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       205 passed, 205 total
```

**PASS**

## Notes

- This aligns the interface declaration with the actual implementation in `SiliconSynapse.idTableInsert()` (lines 1263-1299)
- The implementation returns `true` when insertion succeeds and `false` when the table is full
- Updated JSDoc to document the return value semantics
