# Task 3.4: Add CAS Loop for PACKED_A Patching (Preventive)

**RFC:** 004 (Kernel Remediation)  
**Task:** 3.4  
**Severity:** MEDIUM (Preventive)  
**Status:** IMPLEMENTED

---

## Problem

The existing `patch.ts` methods used non-atomic read-modify-write for `PACKED_A`:

```typescript
// BEFORE (race condition if Worker gains patch access)
const packed = Atomics.load(this.sab, offset + NODE.PACKED_A)
const newPacked = (packed & ~PACKED.PITCH_MASK) | (pitch << PACKED.PITCH_SHIFT)
Atomics.store(this.sab, offset + NODE.PACKED_A, newPacked)  // Lost update possible!
```

While currently only the main thread patches, this is a **latent race** if Workers ever gain patch access. Two threads could:
1. Both read the same `packed` value
2. Both compute `newPacked` with their respective changes
3. One store overwrites the other → lost update

---

## Solution

Implemented two CAS helper methods and updated all PACKED_A patching to use atomic compare-exchange loops:

### 1. CAS Helper for Field Updates (mask/shift pattern)

```typescript
private casUpdatePackedA(
  offset: number,
  mask: number,
  shift: number,
  value: number
): void {
  while (true) {
    const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
    const newPacked = (current & ~mask) | ((value << shift) & mask)

    if (newPacked === current) {
      return // No change needed
    }

    const result = Atomics.compareExchange(
      this.sab,
      offset + NODE.PACKED_A,
      current,
      newPacked
    )

    if (result === current) {
      return // CAS succeeded
    }
    // CAS failed, retry
  }
}
```

### 2. CAS Helper for Custom Update Logic (flags, multi-field)

```typescript
private casUpdatePackedAFn(
  offset: number,
  updateFn: (current: number) => number
): void {
  while (true) {
    const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
    const newPacked = updateFn(current)

    if (newPacked === current) {
      return // No change needed
    }

    const result = Atomics.compareExchange(
      this.sab,
      offset + NODE.PACKED_A,
      current,
      newPacked
    )

    if (result === current) {
      return // CAS succeeded
    }
    // CAS failed, retry
  }
}
```

---

## Updated Methods

| Method | Before | After |
|--------|--------|-------|
| `patchPitch()` | load → modify → store | `casUpdatePackedA()` |
| `patchVelocity()` | load → modify → store | `casUpdatePackedA()` |
| `patchMuted()` | load → modify → store | `casUpdatePackedAFn()` |
| `patchMultiple()` | load → modify → store | `casUpdatePackedAFn()` |

Note: `patchDuration()`, `patchBaseTick()`, and `patchSourceId()` remain unchanged — they write to dedicated i32 fields (already atomic via `Atomics.store`).

---

## CAS Loop Guarantees

1. **No lost updates**: If another thread modifies PACKED_A between load and CAS, the CAS fails and we retry with the new value
2. **Early exit**: If `newPacked === current`, we skip the CAS (no change needed)
3. **Bounded retries**: In practice, single-producer patching means CAS always succeeds on first try

---

## Files Changed

1. `packages/kernel/src/patch.ts`
   - Added `casUpdatePackedA()` private method
   - Added `casUpdatePackedAFn()` private method
   - Updated `patchPitch()` to use CAS
   - Updated `patchVelocity()` to use CAS
   - Updated `patchMuted()` to use CAS
   - Updated `patchMultiple()` to use CAS

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        0.927s
```

All 213 kernel tests pass. Latency unchanged (CAS succeeds on first try in single-producer scenario):

```
patchPitch latency:    { mean: '2.131µs', p99: '2.625µs' }
patchVelocity latency: { mean: '2.228µs', p99: '7.000µs' }
patchMuted latency:    { mean: '1.316µs', p99: '4.042µs' }
```

---

## Why Preventive

This fix is **preventive** — the current architecture has a single producer (main thread) for patches. However:
- Future architectures might allow Worker-based patching
- The code is now **correct by construction**
- Cost is minimal (CAS succeeds on first try)

---

*End of Task 3.4 Log*
