# Directive: Task 004

## Task
Fix import in `SynapticCursor.test.ts` — rename `SynapticCursor` to `ComposerCursor`.

## Requirements

1. Change import from `'../cursors/SynapticCursor'` to `'../cursors/ComposerCursor'`
2. Replace all occurrences of `SynapticCursor` with `ComposerCursor` in the file
3. Fix `MockClip` — add missing abstract methods `advanceTick` and `generateSourceId`

## Files

- `packages/composer/src/__tests__/SynapticCursor.test.ts`

## Changes

### Import (line 1)
```typescript
// Before
import { SynapticCursor } from '../cursors/SynapticCursor';

// After
import { ComposerCursor } from '../cursors/ComposerCursor';
```

### TestCursor class (line 21)
```typescript
// Before
class TestCursor extends SynapticCursor {

// After
class TestCursor extends ComposerCursor {
```

### MockClip missing methods
`SynapticClip` requires three abstract methods. Add:
```typescript
advanceTick(ticks: number) { }
generateSourceId() { return 1; }
```

## Acceptance

- [ ] Test file compiles without module resolution errors
- [ ] `pnpm test --testPathPattern=SynapticCursor` runs
- [ ] No `SynapticCursor` references remain
