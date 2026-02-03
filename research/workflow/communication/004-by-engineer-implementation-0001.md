# Implementation: Task 004

## Changes
- `packages/composer/src/__tests__/SynapticCursor.test.ts`:
  - Changed import from `SynapticCursor` to `ComposerCursor`
  - `TestCursor` now extends `ComposerCursor`
  - Added `advanceTick()` and `generateSourceId()` to `MockClip`
  - Renamed `flush()` to `commit()` in `TestCursor` (required by abstract contract)
  - Updated test assertions to use `commitCalls` instead of `flushCalls`
  - Updated commit logic tests to test `_commit()` guard behavior
  - Renamed describe block from `SynapticCursor` to `ComposerCursor`

## Verify
```
cd packages/composer && pnpm exec jest SynapticCursor.test.ts
```
Output: 6 passed, 6 total

## Acceptance
- [x] Test file compiles without module resolution errors
- [x] Tests run and pass
- [x] No `SynapticCursor` code references remain
