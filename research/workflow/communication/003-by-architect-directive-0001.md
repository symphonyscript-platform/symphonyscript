# Directive: Task 003

## Task
Fix null safety in `SymphonyEngine.ts` — add null check for SharedArrayBuffer.

## Requirements

1. Add null check after `createLinkerSAB()` call at line 66
2. Throw descriptive error if SAB creation fails
3. No other changes to file

## Files

- `packages/composer/src/SymphonyEngine.ts`

## Location

```typescript
// Line 66:
this.sab = createLinkerSAB({ nodeCapacity: options.nodeCapacity ?? 4096 });

// Line 69 (error):
const linker = new SiliconSynapse(this.sab);  // TS2345: sab is SharedArrayBuffer | null
```

## Fix

Insert null check between lines 66 and 68:

```typescript
if (!this.sab) {
    throw new Error('Failed to create SharedArrayBuffer for kernel');
}
```

## Acceptance

- [ ] No TS2345 error at line 69
- [ ] `pnpm exec tsc --noEmit` passes for composer package
- [ ] Error message is descriptive
