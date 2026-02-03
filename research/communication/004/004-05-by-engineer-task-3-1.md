# Task 3.1: Replace NODE_COUNT load+store with Atomics.add/sub

**RFC:** 004 (Kernel Remediation)  
**Task:** 3.1  
**Severity:** MEDIUM (Style/Idiom)  
**Status:** IMPLEMENTED

---

## Problem

NODE_COUNT updates used a non-idiomatic load+store pattern:

```typescript
// BEFORE (non-idiomatic)
const currentCount = Atomics.load(this.sab, HDR.NODE_COUNT)
Atomics.store(this.sab, HDR.NODE_COUNT, currentCount + 1)
```

While this is safe under mutex protection, it's confusing because:
1. Readers might think it's a race condition
2. `Atomics.add()` is the idiomatic pattern
3. Code clarity suffers

---

## Solution

Replace with idiomatic atomic operations:

```typescript
// AFTER (idiomatic)
Atomics.add(this.sab, HDR.NODE_COUNT, 1)   // Increment
Atomics.sub(this.sab, HDR.NODE_COUNT, 1)   // Decrement
```

---

## Locations Updated

| Location | Method | Operation | Line |
|----------|--------|-----------|------|
| 1 | `_insertNode()` | Increment | 625 |
| 2 | `_insertHead()` | Increment | 703 |
| 3 | `_deleteNode()` | Decrement | 777 |
| 4 | `executeInsert()` | Increment | 1837 |

---

## Unchanged Locations

| Location | Method | Reason |
|----------|--------|--------|
| `getNodeCount()` | Getter | Correctly uses `Atomics.load` for reading |
| `executeClear()` | Reset | Correctly uses `Atomics.store` to set to 0 |

---

## Files Changed

1. `packages/kernel/src/silicon-synapse.ts`
   - Line 625: `_insertNode()` - changed to `Atomics.add`
   - Line 703: `_insertHead()` - changed to `Atomics.add`
   - Line 777: `_deleteNode()` - changed to `Atomics.sub`
   - Line 1837: `executeInsert()` - changed to `Atomics.add`

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        9.167s
```

All 213 kernel tests pass.

---

## Code Quality Impact

- **Before:** Readers might question mutex correctness (looks like race condition)
- **After:** Intent is clear (atomic increment/decrement)
- **Behavior:** Identical (mutex already protects these regions)

This is purely a code clarity improvement with no functional change.

---

*End of Task 3.1 Log*
