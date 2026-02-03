# RFC-CURSOR-TEST: SynapticCursor Test Suite Implementation

**Date:** 2026-01-30
**Engineer:** Symphony-Engineer-Zero
**Status:** IMPLEMENTED

---

## Summary

Implemented comprehensive test suite for `SynapticCursor` covering all 8 required test categories plus a critical bug fix discovered during implementation.

## Bug Fix: K-002 Dynamic Capacity

### Issue
`SynapticCursor` hardcoded synapse capacity to `SYNAPSE_TABLE.MAX_CAPACITY` (65536) instead of reading the actual capacity from `HDR.SYNAPSE_CAPACITY`. This caused `RangeError: Invalid atomic access index` when using SABs with smaller dynamic capacity (default: `nodeCapacity * 8`).

### Root Cause
Incorrect comment and assumption:
```typescript
// BEFORE (BUG)
// Capacity is fixed by RFC-045 at 65536
this.capacity = SYNAPSE_TABLE.MAX_CAPACITY
```

RFC-045 defines `MAX_CAPACITY` as an upper bound, not a fixed value. K-002 introduced dynamic sizing.

### Fix Applied
```typescript
// AFTER (FIXED)
// K-002: Read actual capacity from SAB header (dynamic sizing)
// RFC-045 defines MAX_CAPACITY as upper bound, not fixed value
this.capacity = this.sab[HDR.SYNAPSE_CAPACITY]
```

**File:** `packages/synaptic/src/SynapticCursor.ts` (line 93-94)

---

## Test Suite Results

**File:** `packages/synaptic/src/__tests__/SynapticCursor.test.ts`
**Tests:** 33 passing
**Categories:** All 8 required + edge cases

### 1. Construction (5 tests)
- ✅ Initializes with correct default state
- ✅ Initializes with custom initial pointer
- ✅ PRNG seed 0 is coerced to 1 (zero fixpoint handling)
- ✅ SoA candidate arrays are pre-allocated
- ✅ Uses actual SAB capacity (K-002 dynamic sizing) **[NEW - verifies bug fix]**

### 2. Hash Table Lookup (4 tests)
- ✅ Returns correct slot for existing source
- ✅ Returns -1 (no resolution) for non-existent source
- ✅ Handles linear probing (multiple synapses from same source)
- ✅ Returns false when no synapse exists from source

### 3. Candidate Collection (4 tests)
- ✅ Collects valid candidates into SoA arrays
- ✅ Skips tombstones (TARGET_PTR === NULL_PTR)
- ✅ Respects MAX_FIRES_PER_BLOCK quota
- ✅ Handles chain correctly (META_NEXT traversal)

### 4. Weighted Selection (3 tests)
- ✅ Single candidate returns that candidate
- ✅ All weights zero returns first candidate
- ✅ Distribution matches weights (statistical test with fixed seed)

### 5. PRNG Determinism (3 tests)
- ✅ Same seed produces identical sequence
- ✅ Different seeds produce different sequences
- ✅ setSeed() resets state correctly

### 6. Quota Enforcement (3 tests)
- ✅ canFireSynapse() returns true when under quota
- ✅ canFireSynapse() returns false when quota exhausted
- ✅ resetBlockQuota() resets counter

### 7. Resolution Flow (5 tests)
- ✅ Returns false when quota exceeded
- ✅ Returns false when no synapse found
- ✅ Returns true and invokes callback on success
- ✅ Sets pendingJitter and currentPtr correctly
- ✅ Invokes plasticity callback when set

### 8. Jitter Handling (3 tests)
- ✅ hasJitter() reflects pending jitter state
- ✅ hasJitter() returns false when jitter is 0
- ✅ consumeJitter() clears pending jitter

### Edge Cases (3 tests)
- ✅ setCurrentPtr() updates position
- ✅ Plasticity callback can be set to null
- ✅ Multiple consecutive resolutions work correctly

---

## Test Execution

```
PASS @symphonyscript/synaptic src/__tests__/SynapticCursor.test.ts
PASS @symphonyscript/synaptic src/__tests__/SynapticNode.test.ts

Test Suites: 2 passed, 2 total
Tests:       52 passed, 52 total
Snapshots:   0 total
Time:        0.334 s
```

---

## Constraints Satisfied

| Constraint | Status |
|------------|--------|
| Uses `SiliconSynapse.create()` and `SiliconBridge` | ✅ |
| Real kernel interaction (no mocks for internals) | ✅ |
| Deterministic PRNG seeds | ✅ |
| Tests against real SAB | ✅ |
| All 8 categories covered | ✅ |
| All tests pass | ✅ |

---

## Files Modified

1. `packages/synaptic/src/SynapticCursor.ts` - Bug fix (K-002 dynamic capacity)
2. `packages/synaptic/src/__tests__/SynapticCursor.test.ts` - New test suite (33 tests)

---

**Disclaimer:** Awaiting ZERO-TRUST and ZERO-TOLERANCE MANUAL, HOSTILE AND RIGOROUS REVIEW from the architect.
