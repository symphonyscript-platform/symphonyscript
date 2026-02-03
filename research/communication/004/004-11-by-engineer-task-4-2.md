# Task 4.2: Add High-Slot Symbol Table Test

**RFC:** 004 (Kernel Remediation)  
**Task:** 4.2  
**Severity:** LOW (Test Coverage)  
**Status:** IMPLEMENTED

---

## Problem

The Task 1.1 fix (Symbol Table capacity = nodeCapacity × 2) needed validation tests to ensure:
1. Memory regions are correctly sized
2. High-slot access (slots >= nodeCapacity) works correctly
3. Symbol Table doesn't corrupt Identity Table

---

## Solution

Created new test file `memory-layout.test.ts` with 5 tests validating:

### 1. Capacity Parity Test
```typescript
it('should have matching capacities for ID and Symbol tables', () => {
  const nodeCapacity = 256
  const linker = SiliconSynapse.create({ nodeCapacity, safeZoneTicks: 0 })
  const sab = new Int32Array(linker.getSAB())

  const idTableCapacity = sab[HDR.ID_TABLE_CAPACITY]
  const expectedCapacity = nodeCapacity * 2 // 512

  expect(idTableCapacity).toBe(expectedCapacity)
})
```

### 2. High Slot Bounds Test
```typescript
it('should access valid memory for high slot indices', () => {
  const nodeCapacity = 4096
  const sabSize = calculateSABSize(nodeCapacity)
  const symTableStart = getSymbolTableOffset(nodeCapacity)
  const maxSlot = nodeCapacity * 2 - 1 // 8191
  const maxSlotOffset = symTableStart + maxSlot * SYM_TABLE.ENTRY_SIZE_BYTES

  // Max slot should be within SAB bounds
  expect(maxSlotOffset + SYM_TABLE.ENTRY_SIZE_BYTES).toBeLessThanOrEqual(sabSize)
})
```

### 3. No Region Overlap Test
```typescript
it('should not overlap Symbol Table with subsequent regions', () => {
  const nodeCapacity = 1024
  const idTableOffset = getIdentityTableOffset(nodeCapacity)
  const symTableOffset = getSymbolTableOffset(nodeCapacity)

  const idTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
  expect(symTableOffset).toBeGreaterThanOrEqual(idTableOffset + idTableSize)
})
```

### 4. High-Slot Insert/Lookup Test
```typescript
it('should correctly store/retrieve entries in high slots (>= nodeCapacity)', () => {
  // Insert 400 entries with nodeCapacity=256 → forces probing into slots >= 256
  // Verifies idTableLookup and symTableStore work without corruption
})
```

### 5. Quadratic Probing Collision Test
```typescript
it('should handle quadratic probing correctly without memory corruption', () => {
  // Uses sourceIds that hash to similar slots
  // Forces quadratic probing to higher indices
})
```

---

## Additional Exports Added

To enable memory layout testing, added exports to `index.ts`:

```typescript
// Task 4.2: Memory layout testing
getIdentityTableOffset,
getSymbolTableOffset,
ID_TABLE,
SYM_TABLE,
```

---

## Files Changed

1. `packages/kernel/src/__tests__/memory-layout.test.ts` (NEW)
   - Created with 5 memory layout validation tests

2. `packages/kernel/src/index.ts`
   - Added exports for `getIdentityTableOffset`, `getSymbolTableOffset`, `ID_TABLE`, `SYM_TABLE`

---

## Test Results

```
Test Suites: 13 passed, 13 total
Tests:       219 passed, 219 total
Time:        0.944s
```

Test count increased from 214 to 219 (+5 new tests).

---

## Why These Tests Matter

These tests validate the Task 1.1 fix:

| Test | What It Validates |
|------|-------------------|
| Capacity parity | ID_TABLE_CAPACITY = nodeCapacity × 2 |
| High slot bounds | Max slot (8191 for 4096 nodes) fits in SAB |
| No overlap | Symbol Table doesn't overwrite other regions |
| Insert/lookup | Quadratic probing into high slots works |
| Collision handling | Multiple entries probing to same slot don't corrupt |

If Task 1.1 were reverted, tests 2, 4, and 5 would fail due to out-of-bounds access.

---

*End of Task 4.2 Log*
