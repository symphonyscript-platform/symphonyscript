# H-001: Test for FREE_LIST_CORRUPT Error Path Fix

**Fix ID:** H-001
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

The free list corruption detection code (`ERROR.FREE_LIST_CORRUPT`) was never tested. Coverage showed these error paths as uncovered, meaning memory corruption detection might not work correctly.

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`
- `packages/kernel/src/__tests__/stress-tests.test.ts`

## Changes Made

### 1. Test Added in `stress-tests.test.ts`

```typescript
it('should detect corrupted free list head', () => {
  const sab = createLinkerSAB({ nodeCapacity: 8 })
  const sab64 = new BigInt64Array(sab)
  const sabView = new Int32Array(sab)
  const linker = new SiliconSynapse(sab)

  // Corrupt free list head with invalid pointer
  // FREE_LIST_HEAD is stored as 64-bit tagged pointer at i64 index 3
  const HDR_I64_FREE_LIST_HEAD = 3
  sab64[HDR_I64_FREE_LIST_HEAD] = BigInt(0xDEADBEEF)

  // Attempt allocation - should detect invalid pointer in free list
  const ptr = linker.allocNode()
  expect(ptr).toBe(NULL_PTR)
  expect(sabView[HDR.ERROR_FLAG]).toBe(ERROR.FREE_LIST_CORRUPT)
})
```

### 2. Bug Fix in `allocNode()` (discovered during test implementation)

The test revealed that `allocNode()` was unconditionally overwriting `ERROR.FREE_LIST_CORRUPT` with `HEAP_EXHAUSTED` when `freeList.alloc()` returned `NULL_PTR`.

**Before:**
```typescript
allocNode(): NodePtr {
  const ptr = this.freeList.alloc()
  if (ptr === NULL_PTR) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.HEAP_EXHAUSTED)
  }
  return ptr
}
```

**After:**
```typescript
allocNode(): NodePtr {
  const ptr = this.freeList.alloc()
  if (ptr === NULL_PTR) {
    // Only set HEAP_EXHAUSTED if no error is already set (e.g., FREE_LIST_CORRUPT)
    const currentError = Atomics.load(this.sab, HDR.ERROR_FLAG)
    if (currentError === ERROR.OK) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.HEAP_EXHAUSTED)
    }
  }
  return ptr
}
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       205 passed, 205 total
```

**PASS**

## Notes

- Test validates that corrupting the 64-bit tagged free list head triggers `FREE_LIST_CORRUPT` error
- The corruption is detected by `isValidPtr()` check in `free-list.ts` line 120-123
- The additional fix to `allocNode()` preserves the more specific error code instead of clobbering it with a generic `HEAP_EXHAUSTED`
