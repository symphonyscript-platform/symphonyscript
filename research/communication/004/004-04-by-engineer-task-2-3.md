# Task 2.3: Hoist BigInt(ptr) Before Loop in free()

**RFC:** 004 (Kernel Remediation)  
**Task:** 2.3  
**Severity:** LOW  
**Status:** IMPLEMENTED

---

## Problem

In `free()`, the `BigInt(ptr)` conversion was inside the CAS loop:

```typescript
// BEFORE
while (true) {
  // ... CAS loop ...
  const newHead = (newVersion << 32n) | BigInt(ptr)  // Allocates on every retry!
  // ... CAS ...
}
```

Since `ptr` is constant throughout the loop (the pointer being freed doesn't change), this caused unnecessary BigInt allocation on every CAS retry.

---

## Solution

Hoist the `BigInt(ptr)` conversion before the loop:

```typescript
// AFTER
// HOISTED: ptr is constant across CAS retries, so convert to BigInt once
const ptrBigInt = BigInt(ptr)

while (true) {
  // ... CAS loop ...
  // ptrBigInt is hoisted - no allocation on retry
  const newHead = (newVersion << 32n) | ptrBigInt
  // ... CAS ...
}
```

---

## Impact Analysis

### Before Fix
- CAS retry: Allocates ~16-24 bytes for BigInt
- High contention: Multiple allocations per `free()` call
- GC pressure: Short-lived nursery objects

### After Fix
- CAS retry: Zero allocation
- High contention: Still only ONE allocation per `free()` call
- GC pressure: Reduced

### Why `alloc()` Wasn't Changed
The remediation plan explicitly accepts `BigInt(next)` in `alloc()` as a once-per-call trade-off:

```typescript
// alloc() - next changes on each retry (depends on head)
const next = Atomics.load(this.sab, headOffset + NODE.PACKED_A)
const newHead = (newVersion << 32n) | BigInt(next)  // Can't hoist - next varies
```

In `alloc()`, `next` depends on the current head which changes on CAS failure, so it cannot be hoisted.

---

## Files Changed

1. `packages/kernel/src/free-list.ts`
   - Line 188: Added `const ptrBigInt = BigInt(ptr)` before loop
   - Line 207: Changed `BigInt(ptr)` to `ptrBigInt`
   - Added comments explaining the hoisting

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        8.975s
```

All 213 kernel tests pass.

---

## Zero-Allocation Compliance

| Method | Before | After |
|--------|--------|-------|
| `free()` normal | 1 BigInt | 1 BigInt |
| `free()` CAS retry | N BigInts | 1 BigInt |
| `alloc()` normal | 1 BigInt | 1 BigInt (unchanged, accepted) |
| `alloc()` CAS retry | N BigInts | N BigInts (unchanged, unavoidable) |

The fix eliminates retry allocations in `free()` while acknowledging that `alloc()` allocation is an accepted trade-off for ABA safety.

---

*End of Task 2.3 Log*
