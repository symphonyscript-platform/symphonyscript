# Task 3.5: Add idTableRebuild() Method

**RFC:** 004 (Kernel Remediation)  
**Task:** 3.5  
**Severity:** MEDIUM (Spec Debt)  
**Status:** IMPLEMENTED

---

## Problem

The spec defined `idTableClear()` but provided no way to rebuild the Identity Table after clearing. This created a gap:

1. `idTableClear()` removes all entries and tombstones
2. But the live chain still has nodes with `sourceId > 0`
3. Those nodes become unreachable via `idTableLookup()`

**Use Cases:**
- After manual `idTableClear()` call
- When tombstone count exceeds threshold (future compaction trigger)

---

## Solution

Added `idTableRebuild()` method that:
1. Acquires Chain Mutex (thread safety)
2. Clears the table (removes tombstones)
3. Traverses the live chain
4. Re-inserts all valid sourceIds
5. Releases mutex and returns count

```typescript
/**
 * Rebuild the Identity Table from the live chain.
 * Task 3.5: Addresses spec debt — no way to rebuild ID table after clearing.
 *
 * **Use Case:** After idTableClear() or when tombstones exceed threshold.
 *
 * **Thread Safety:** Acquires Chain Mutex for duration.
 *
 * @returns Number of entries rebuilt, or -1 if mutex acquisition failed
 */
idTableRebuild(): number {
  if (!this._acquireChainMutex()) {
    return -1
  }

  // 1. Clear table (removes all tombstones)
  this.idTableClear()

  // 2. Traverse chain and re-insert all sourceIds
  let count = 0
  let ptr = Atomics.load(this.sab, HDR.HEAD_PTR)

  while (ptr !== NULL_PTR) {
    const offset = this.nodeOffset(ptr)
    const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)

    if (sourceId > 0) {
      this.idTableInsert(sourceId, ptr)
      count = count + 1
    }

    ptr = Atomics.load(this.sab, offset + NODE.NEXT_PTR)
  }

  this._releaseChainMutex()
  return count
}
```

---

## Implementation Notes

### Zero-Allocation Compliance

The method uses:
- Primitive loop counter (`let count = 0`)
- Primitive pointer (`let ptr = ...`)
- No try/catch (mutex release is unconditional)
- `count = count + 1` instead of `count++` (explicit style)

### Thread Safety

- Mutex acquired at start, released at end
- Returns `-1` on mutex acquisition failure (contention/deadlock)
- All chain reads use `Atomics.load`
- `idTableClear()` and `idTableInsert()` already use atomic operations

### Return Value Semantics

| Return Value | Meaning |
|-------------|---------|
| `-1` | Mutex acquisition failed |
| `0` | Success, but no sourceIds in chain (all nodes have sourceId = 0) |
| `N > 0` | Success, N entries rebuilt |

---

## Files Changed

1. `packages/kernel/src/silicon-synapse.ts`
   - Added `idTableRebuild()` method (lines 1498-1530)

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        0.929s
```

All 213 kernel tests pass.

---

## Location in File

The method is placed immediately after `idTableClear()` in the Identity Table Operations section:

```
// ===========================================================================
// Identity Table Operations (v1.5) - SourceId → NodePtr
// ===========================================================================

  idTableSlotOffset(slot)    // private
  idTableHash(sourceId)      // private  
  idTableInsert(sourceId, ptr)
  idTableRemove(sourceId)
  idTableLookup(sourceId)
  idTableClear()
  idTableRebuild()           // ← NEW (Task 3.5)

// ===========================================================================
// Symbol Table Operations (v1.5) - SourceId → Packed SourceLocation
// ===========================================================================
```

---

*End of Task 3.5 Log*
