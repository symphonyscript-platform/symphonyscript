# Task 002: Fix Null Safety in Clip.ts

**Priority:** CRITICAL  
**Category:** Build Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

`Clip.ts` passes potentially null values to functions expecting non-null parameters.

## Location

```
packages/composer/src/Clip.ts:36
```

## Evidence

```
error TS2345: Argument of type 'SiliconSynapse | null' is not assignable to parameter of type 'SiliconSynapse'.
  Type 'null' is not assignable to type 'SiliconSynapse'.
```

## Impact

- TypeScript compilation fails
- Potential runtime null pointer exceptions

## Remediation

Add null check before using the synapse:

```typescript
const synapse = session.getSynapse();
if (!synapse) {
    throw new Error('Session synapse not initialized');
}
// Now synapse is guaranteed non-null
```

Or use non-null assertion if the context guarantees it's initialized:

```typescript
const synapse = session.getSynapse()!;
```

## Acceptance Criteria

- [ ] No TS2345 errors related to null assignment
- [ ] Proper error handling for null cases
- [ ] `pnpm build` passes
