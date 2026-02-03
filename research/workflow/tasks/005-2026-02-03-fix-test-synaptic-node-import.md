# Task 005: Fix SynapticNode.test.ts Import

**Priority:** CRITICAL  
**Category:** Test Health  
**Status:** Open  
**Created:** 2026-02-03  
**Source:** Composer Audit

---

## Problem

Test file imports from `../core/SynapticNode` which doesn't exist. `SynapticNode` is in `@symphonyscript/synaptic` package.

## Location

```
packages/composer/src/__tests__/SynapticNode.test.ts:1
```

## Evidence

```
Cannot find module '../core/SynapticNode' from 'src/__tests__/SynapticNode.test.ts'
```

## Impact

- Test suite fails to run
- Tests for SynapticNode inheritance are not running

## Remediation

**Option A:** Delete the test file (SynapticNode tests belong in synaptic package)

**Option B:** Update import to correct package:

```typescript
// Before
import { SynapticNode } from '../core/SynapticNode';

// After
import { SynapticNode } from '@symphonyscript/synaptic';
```

**Recommendation:** Option A - SynapticNode tests should be in `@symphonyscript/synaptic`, not in composer.

## Acceptance Criteria

- [ ] No module resolution errors for this test
- [ ] `pnpm test` runs without "Cannot find module" errors
