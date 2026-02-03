# Task 2.2: Fix Reclaim Ring Non-Atomic Write

**RFC:** 004 (Kernel Remediation)  
**Task:** 2.2  
**Severity:** HIGH  
**Status:** IMPLEMENTED

---

## Problem

The Reclaim Ring write at line 801 used raw array assignment instead of `Atomics.store()`:

```typescript
// BEFORE
this.sab[ringDataI32 + idx] = ptr  // Raw assignment

// Commit write
Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
```

**Issue:** On weakly-ordered architectures (ARM), stores can be reordered. The tail update (commit) could become visible to the consumer BEFORE the data write completes. The consumer would then read uninitialized/stale data from the ring buffer slot.

---

## Solution

Replace raw array assignment with `Atomics.store()` to ensure proper memory ordering:

```typescript
// AFTER
// Write pointer atomically (release semantics on ARM)
Atomics.store(this.sab, ringDataI32 + idx, ptr)

// Commit write (consumer will see data due to acquire-release)
Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
```

---

## Memory Model Analysis

### x86 (Intel/AMD)
- Strong memory model with total store ordering (TSO)
- Raw assignment already has release semantics
- Fix has no performance impact (same behavior)

### ARM (Apple Silicon, Mobile)
- Weak memory model with relaxed ordering
- Raw assignment can be reordered with subsequent stores
- `Atomics.store()` inserts proper memory barrier
- Fix prevents data visibility race

### ECMAScript Atomics Guarantee
- `Atomics.store()` guarantees sequentially consistent (SC) semantics
- All prior writes are visible before the atomic store completes
- Consumer's `Atomics.load()` on TAIL will see the data write

---

## Files Changed

1. `packages/kernel/src/silicon-synapse.ts`
   - Line 801: Changed `this.sab[ringDataI32 + idx] = ptr` to `Atomics.store(this.sab, ringDataI32 + idx, ptr)`
   - Updated comments to document memory ordering

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        10.117s
```

All 213 kernel tests pass.

---

## SPSC Ring Buffer Protocol Verification

The Reclaim Ring follows the SPSC (Single Producer, Single Consumer) pattern:
- **Producer (Worker):** Writes data, then increments TAIL
- **Consumer (Main):** Reads HEAD, compares to TAIL, reads data, increments HEAD

With this fix, the protocol is now correct:
1. Producer writes data with `Atomics.store()` (release)
2. Producer commits with `Atomics.store(TAIL)` (release)
3. Consumer loads TAIL with `Atomics.load()` (acquire)
4. Consumer loads data with `Atomics.load()` (acquire)

The acquire-release pairing ensures data is visible when TAIL indicates it's ready.

---

*End of Task 2.2 Log*
