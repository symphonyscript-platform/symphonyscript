# Task 004: Fix SynapticCursor.test.ts Import

**Priority:** CRITICAL  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Test file imports `SynapticCursor` from a non-existent path. The class is named `ComposerCursor`.

## Location

```
packages/composer/src/__tests__/SynapticCursor.test.ts:1
```

## Evidence

```
Cannot find module '../cursors/SynapticCursor' from 'src/__tests__/SynapticCursor.test.ts'
```

## Impact

- Test suite fails to run
- 0% test coverage for base cursor

## Remediation

Change import to use the correct class name:

```typescript
// Before
import { SynapticCursor } from '../cursors/SynapticCursor';

// After
import { ComposerCursor } from '../cursors/ComposerCursor';
```

Also update all references to `SynapticCursor` in the test file to `ComposerCursor`.

## Acceptance Criteria

- [ ] Test file compiles
- [ ] Tests pass (or fail for legitimate reasons)
- [ ] `pnpm test` runs without module resolution errors
