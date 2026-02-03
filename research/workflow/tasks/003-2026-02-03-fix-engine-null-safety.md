# Task 003: Fix Null Safety in SymphonyEngine.ts

**Priority:** CRITICAL  
**Category:** Build Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

`SymphonyEngine.ts` passes potentially null SharedArrayBuffer to functions expecting non-null.

## Location

```
packages/composer/src/SymphonyEngine.ts:69
```

## Evidence

```
error TS2345: Argument of type 'SharedArrayBuffer | null' is not assignable to parameter of type 'SharedArrayBuffer'.
  Type 'null' is not assignable to type 'SharedArrayBuffer'.
```

## Impact

- TypeScript compilation fails
- Potential runtime crash if SAB is null

## Remediation

Add null check before using the SharedArrayBuffer:

```typescript
const sab = this.getSharedArrayBuffer();
if (!sab) {
    throw new Error('SharedArrayBuffer not initialized. Call init() first.');
}
```

## Acceptance Criteria

- [ ] No TS2345 errors related to SharedArrayBuffer
- [ ] Clear error message if SAB is not initialized
- [ ] `pnpm build` passes
