# Task 1.1: Fix Symbol Table Capacity Mismatch

**RFC:** 004 (Kernel Remediation)  
**Task:** 1.1  
**Severity:** CRITICAL  
**Status:** IMPLEMENTED

---

## Problem

The Symbol Table capacity was mismatched with the Identity Table capacity:

- **Identity Table:** Uses `nodeCapacity * 2` slots (for load factor < 50%)
- **Symbol Table:** Was only using `nodeCapacity` slots

Since both tables share slot indices via quadratic probing, a sourceId that probes to slot `>= nodeCapacity` would cause Symbol Table data to be written out-of-bounds, potentially corrupting the Groove Templates, Command Ring Buffer, or other memory regions.

---

## Changes Made

### 1. `constants.ts:908` - `getSymbolTableOffset()`

```typescript
// BEFORE
export function getSymbolTableOffset(nodeCapacity: number): number {
  return getIdentityTableOffset(nodeCapacity) + nodeCapacity * ID_TABLE.ENTRY_SIZE_BYTES
}

// AFTER
export function getSymbolTableOffset(nodeCapacity: number): number {
  // RFC-047-50: Identity Table uses 2x capacity for load factor
  // Symbol Table must account for full Identity Table size
  return getIdentityTableOffset(nodeCapacity) + nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
}
```

### 2. `constants.ts:864` - `calculateSABSize()`

```typescript
// BEFORE
const symbolTableSize = nodeCapacity * SYM_TABLE.ENTRY_SIZE_BYTES // 8 bytes per entry

// AFTER
const symbolTableSize = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES // Must match Identity Table capacity
```

### 3. `constants.ts:917` - `getGrooveTemplateOffset()`

```typescript
// BEFORE
export function getGrooveTemplateOffset(nodeCapacity: number): number {
  return getSymbolTableOffset(nodeCapacity) + nodeCapacity * SYM_TABLE.ENTRY_SIZE_BYTES
}

// AFTER
export function getGrooveTemplateOffset(nodeCapacity: number): number {
  // Must match Symbol Table capacity (nodeCapacity * 2)
  return getSymbolTableOffset(nodeCapacity) + nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES
}
```

### 4. `init.ts:225` - `initializeSymbolTable()`

```typescript
// BEFORE
const totalI32 = nodeCapacity * SYM_TABLE.ENTRY_SIZE_I32

// AFTER
// Must match Identity Table capacity (2x nodeCapacity)
const totalI32 = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_I32
```

---

## Memory Layout Impact

For `nodeCapacity = 4096`:

| Region | Before (bytes) | After (bytes) |
|--------|---------------|---------------|
| Identity Table | 65,536 | 65,536 |
| Symbol Table | 32,768 | 65,536 |
| Total SAB increase | - | +32,768 |

The Symbol Table now correctly matches the Identity Table capacity, preventing out-of-bounds access for high-slot-index entries.

---

## Files Changed

1. `packages/kernel/src/constants.ts`
   - `getSymbolTableOffset()` - line 908
   - `calculateSABSize()` - line 864
   - `getGrooveTemplateOffset()` - line 917

2. `packages/kernel/src/init.ts`
   - `initializeSymbolTable()` - line 225

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        9.914s
```

All 213 kernel tests pass.

---

## Verification

The fix ensures:
1. Symbol Table offset accounts for full Identity Table size (2x nodeCapacity)
2. SAB size calculation includes correct Symbol Table size
3. Symbol Table initialization clears all 2x nodeCapacity slots
4. Groove Template offset correctly follows enlarged Symbol Table

---

*End of Task 1.1 Log*
