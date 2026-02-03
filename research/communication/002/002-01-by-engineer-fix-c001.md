# C-001: Symbol Table Probing Inconsistency Fix

**Fix ID:** C-001
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

Symbol Table methods used linear probing while Identity Table used quadratic probing. After hash collisions, lookups could fail because entries were stored at different slots in each table.

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`
- `packages/kernel/src/__tests__/stress-tests.test.ts`

## Changes Made

### 1. `symTableStore()` (lines 1435-1462)

**Before (linear probing):**
```typescript
let slot = this.idTableHash(sourceId)
let i = 0
while (i < capacity) {
  // ... check slot ...
  slot = (slot + 1) & (capacity - 1)  // LINEAR
  i = i + 1
}
```

**After (quadratic probing):**
```typescript
const baseSlot = this.idTableHash(sourceId)
for (let probe = 0; probe < capacity; probe++) {
  const slot = (baseSlot + probe * probe) & (capacity - 1)  // QUADRATIC
  // ... check slot ...
}
```

### 2. `symTableLookup()` (lines 1468-1518)

**Before (linear probing):**
```typescript
let slot = this.idTableHash(sourceId)
let i = 0
while (i < capacity) {
  // ... check slot ...
  slot = (slot + 1) & (capacity - 1)  // LINEAR
  i = i + 1
}
```

**After (quadratic probing):**
```typescript
const baseSlot = this.idTableHash(sourceId)
for (let probe = 0; probe < capacity; probe++) {
  const slot = (baseSlot + probe * probe) & (capacity - 1)  // QUADRATIC
  // ... check slot ...
}
```

### 3. `symTableRemove()` (lines 1523-1559)

**Before (linear probing):**
```typescript
let slot = this.idTableHash(sourceId)
let i = 0
while (i < capacity) {
  // ... check slot ...
  slot = (slot + 1) & (capacity - 1)  // LINEAR
  i = i + 1
}
```

**After (quadratic probing):**
```typescript
const baseSlot = this.idTableHash(sourceId)
for (let probe = 0; probe < capacity; probe++) {
  const slot = (baseSlot + probe * probe) & (capacity - 1)  // QUADRATIC
  // ... check slot ...
}
```

### 4. Test Added

Added test `should handle Symbol Table collisions with quadratic probing` in `stress-tests.test.ts`:

```typescript
it('should handle Symbol Table collisions with quadratic probing', () => {
  const linker = createTestLinker(64)

  const sourceId1 = 1000
  const sourceId2 = 2000
  const sourceId3 = 3000

  // Insert into Identity Table via insertHead
  const ptr1 = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, sourceId1, FLAG.ACTIVE)
  const ptr2 = linker.insertHead(OPCODE.NOTE, 61, 100, 96, 10, sourceId2, FLAG.ACTIVE)
  const ptr3 = linker.insertHead(OPCODE.NOTE, 62, 100, 96, 20, sourceId3, FLAG.ACTIVE)

  // Verify Identity Table insertions worked
  expect(linker.idTableLookup(sourceId1)).toBe(ptr1)
  expect(linker.idTableLookup(sourceId2)).toBe(ptr2)
  expect(linker.idTableLookup(sourceId3)).toBe(ptr3)

  // Store symbol data
  linker.symTableStore(sourceId1, 0x1111, 10, 5)
  linker.symTableStore(sourceId2, 0x2222, 20, 10)
  linker.symTableStore(sourceId3, 0x3333, 30, 15)

  // Verify all can be retrieved
  let found1 = false, found2 = false, found3 = false
  linker.symTableLookup(sourceId1, (fh, l, c) => { found1 = (fh === 0x1111 && l === 10 && c === 5) })
  linker.symTableLookup(sourceId2, (fh, l, c) => { found2 = (fh === 0x2222 && l === 20 && c === 10) })
  linker.symTableLookup(sourceId3, (fh, l, c) => { found3 = (fh === 0x3333 && l === 30 && c === 15) })

  expect(found1).toBe(true)
  expect(found2).toBe(true)
  expect(found3).toBe(true)

  // Test removal also uses quadratic probing
  expect(linker.symTableRemove(sourceId2)).toBe(true)
  // ... verify sourceId2 removed, others still found ...
})
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       203 passed, 203 total
```

**PASS**

## Notes

- All three Symbol Table methods now match Identity Table's quadratic probing formula: `slot = (baseSlot + probe²) & (capacity - 1)`
- Updated JSDoc comments to reference RFC-047-50 for consistency
- Test verifies store, lookup, and remove operations work correctly
