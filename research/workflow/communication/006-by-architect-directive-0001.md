# Directive: Task 006

## Task
Replace `flush()` with `commit()` in test files.

## Requirements

Replace all occurrences of `.flush()` with `.commit()`:

### `SynapticNoteCursor.test.ts`
- Line 76: `cursor.flush()` → `cursor.commit()`

### `SynapticMelodyNoteCursor.test.ts`
- Line 95: `cursor.flush()` → `cursor.commit()`

### `SynapticChordCursor.test.ts`
- Line 42: `cursor.flush()` → `cursor.commit()`
- Line 53: `cursor.flush()` → `cursor.commit()`
- Line 66: `cursor.flush()` → `cursor.commit()`
- Line 101: `pureCursor.flush()` → `pureCursor.commit()`
- Line 110: `pureCursor.flush()` → `pureCursor.commit()`

## Files

- `packages/composer/src/__tests__/SynapticNoteCursor.test.ts`
- `packages/composer/src/__tests__/SynapticChordCursor.test.ts`
- `packages/composer/src/__tests__/SynapticMelodyNoteCursor.test.ts`

## Acceptance

- [ ] No `.flush()` calls remain in test files
- [ ] All replaced with `.commit()`
- [ ] `pnpm test --testPathPattern="Synaptic.*Cursor"` passes
