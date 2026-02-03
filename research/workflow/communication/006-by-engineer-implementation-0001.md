# Implementation: Task 006

## Changes
- `packages/composer/src/__tests__/SynapticNoteCursor.test.ts`:
  - Line 76: `cursor.flush()` → `cursor.commit()`

- `packages/composer/src/__tests__/SynapticMelodyNoteCursor.test.ts`:
  - Line 95: `cursor.flush()` → `cursor.commit()`

- `packages/composer/src/__tests__/SynapticChordCursor.test.ts`:
  - Line 42: `cursor.flush()` → `cursor.commit()`
  - Line 53: `cursor.flush()` → `cursor.commit()`
  - Line 66: `cursor.flush()` → `cursor.commit()`
  - Line 101: `pureCursor.flush()` → `pureCursor.commit()`
  - Line 110: `pureCursor.flush()` → `pureCursor.commit()`

## Verify
```
cd packages/composer && pnpm exec jest "Synaptic.*Cursor"
```
Output: 4 suites, 16 tests passed

```
grep -r "\.flush()" packages/composer/src/__tests__/
```
Output: No matches

## Acceptance
- [x] No `.flush()` calls remain in test files
- [x] All replaced with `.commit()`
- [x] All Synaptic*Cursor tests pass (16/16)
