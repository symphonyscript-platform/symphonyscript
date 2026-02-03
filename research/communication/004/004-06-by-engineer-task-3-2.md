# Task 3.2: Add Synapse Capacity Power-of-2 Validation

**RFC:** 004 (Kernel Remediation)  
**Task:** 3.2  
**Severity:** MEDIUM  
**Status:** IMPLEMENTED

---

## Problem

The Synapse Table hash function uses bitwise AND for modulo:

```typescript
const slot = hash & (capacity - 1)  // Fast modulo, requires power-of-2
```

This bitwise optimization only works correctly when capacity is a power of 2. Without validation, non-power-of-2 capacity would cause incorrect hash distribution and potential data corruption.

---

## Solution

Added validation in `createLinkerSAB()` to reject non-power-of-2 synapse capacities:

```typescript
// Validate synapse capacity is power of 2 (required for hash mask: & (capacity - 1))
if (effectiveSynapseCapacity <= 0 || (effectiveSynapseCapacity & (effectiveSynapseCapacity - 1)) !== 0) {
  throw new Error(
    `synapseCapacity must be a power of 2, got ${effectiveSynapseCapacity}`
  )
}
```

---

## Power-of-2 Check Algorithm

The expression `(n & (n - 1)) === 0` is a classic bit manipulation trick:
- For n = 8 (1000 binary): 8 & 7 = 1000 & 0111 = 0 ✓
- For n = 6 (0110 binary): 6 & 5 = 0110 & 0101 = 0100 ≠ 0 ✗

The check `n > 0` ensures we don't accept 0 (which would also pass the bit check).

---

## Test Updates Required

Several tests used non-power-of-2 values for `nodeCapacity`, which resulted in non-power-of-2 `synapseCapacity` (nodeCapacity * 8):

| Test File | Before | After | Reason |
|-----------|--------|-------|--------|
| `silicon-linker.test.ts` | nodeCapacity: 100 | nodeCapacity: 128 | 100*8=800 ✗, 128*8=1024 ✓ |
| `k-002-scalability.test.ts` | synapseCapacity: 20000 | synapseCapacity: 16384 | 20000 ✗, 16384 ✓ |
| `benchmark.test.ts` | nodeCapacity: 1000 | nodeCapacity: 1024 | 1000*8=8000 ✗, 1024*8=8192 ✓ |
| `benchmark.test.ts` | nodeCapacity: 2000 | nodeCapacity: 2048 | 2000*8=16000 ✗, 2048*8=16384 ✓ |
| `benchmark.test.ts` | nodeCapacity: 12000 | nodeCapacity: 16384 | 12000*8=96000 ✗, 16384*8=131072 ✓ |
| `benchmark.test.ts` | nodeCapacity: 100 | nodeCapacity: 128 | 100*8=800 ✗, 128*8=1024 ✓ |

---

## Files Changed

1. `packages/kernel/src/init.ts`
   - Added power-of-2 validation after calculating effectiveSynapseCapacity

2. `packages/kernel/src/__tests__/silicon-linker.test.ts`
   - Changed nodeCapacity: 100 → 128

3. `packages/kernel/src/__tests__/k-002-scalability.test.ts`
   - Changed synapseCapacity: 20000 → 16384

4. `packages/kernel/src/__tests__/benchmark.test.ts`
   - Changed nodeCapacity: 1000 → 1024
   - Changed nodeCapacity: 2000 → 2048 (4 locations)
   - Changed nodeCapacity: 12000 → 16384
   - Changed nodeCapacity: 100 → 128

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        0.83s
```

All 213 kernel tests pass.

---

## Error Message Example

```
Error: synapseCapacity must be a power of 2, got 800
```

This makes it clear to developers that capacity must be a power of 2 (e.g., 512, 1024, 2048, 4096, etc.).

---

*End of Task 3.2 Log*
