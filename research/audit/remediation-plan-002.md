# Kernel Remediation Plan (Audit-002)

**Date**: 2026-01-28
**Priority**: CRITICAL → HIGH → MEDIUM → LOW

---

## Priority 1: CRITICAL (Must Fix Before Release)

### C-001: Symbol Table Probing Inconsistency [CRITICAL]

**Issue**: Symbol Table uses linear probing while Identity Table uses quadratic probing.

**Risk**: When a sourceId is inserted into both tables after hash collisions, they may store at different slots. Subsequent lookups will fail.

**Fix Location**: `silicon-synapse.ts:1440-1465`

**Change**: Replace linear probing with quadratic probing:

```typescript
// BEFORE (linear probing):
slot = (slot + 1) & (capacity - 1)

// AFTER (quadratic probing):
const slot = (baseSlot + probe * probe) & (capacity - 1)
```

**Effort**: Small (30 min)

**Test**: Verify `symTableStore` followed by `symTableLookup` returns correct data after collisions.

---

### C-002: executeDelete Does Not Clean Up Identity Table [CRITICAL]

**Issue**: `executeDelete()` does not call `idTableRemove()`, leaving dangling pointers.

**Risk**: Use-after-free vulnerability when looking up deleted nodes.

**Fix Location**: `silicon-synapse.ts:1773-1777`

**Change**:
```typescript
private executeDelete(ptr: NodePtr): boolean {
  // Extract sourceId BEFORE unlinking
  const offset = ptr / 4
  const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)

  // Delete from chain
  const success = this._deleteNode(ptr)

  // Clean up Identity Table
  if (success && sourceId > 0) {
    this.idTableRemove(sourceId)
    this.symTableRemove(sourceId)
  }

  return success
}
```

**Effort**: Small (15 min)

**Test**: Verify `idTableLookup(deletedSourceId)` returns NULL_PTR after `executeDelete`.

---

### C-003: Document MockConsumer Allocation Behavior [CRITICAL]

**Issue**: MockConsumer allocates arrays in hot path, patterns may be copied to production.

**Risk**: Audio glitches if patterns are mimicked in AudioWorklet.

**Fix Location**: `mock-consumer.ts:1-10`

**Change**: Add prominent warning comment:

```typescript
/**
 * MockConsumer - Test-Only Consumer Implementation
 *
 * ⚠️ WARNING: This class intentionally ALLOCATES memory and should
 * NEVER be used as a template for production AudioWorklet code.
 * The push() operations and event arrays here would cause GC pauses.
 *
 * For production AudioWorklet implementation, see RFC-043 Section 7:
 * "Consumer Implementation Guidelines" for zero-allocation patterns.
 */
```

**Effort**: Minimal (5 min)

---

## Priority 2: HIGH (Fix Before v1.0)

### H-001: Add Test for UNKNOWN_OPCODE Error Path

**Issue**: Default case in `processCommands()` switch never tested.

**Fix Location**: `__tests__/stress-tests.test.ts` (already added)

**Verify**: Run test suite and confirm test passes.

**Effort**: Done (0 min)

---

### H-002: Add Test for FREE_LIST_CORRUPT Error Path

**Issue**: Free list corruption detection never tested.

**Fix Location**: Create new test in `__tests__/stress-tests.test.ts`

**Change**:
```typescript
it('should detect corrupted free list head', () => {
  const sab = createLinkerSAB({ nodeCapacity: 8 })
  const sab64 = new BigInt64Array(sab)
  const linker = new SiliconSynapse(sab)

  // Corrupt free list head (invalid pointer)
  const HDR_I64_FREE_LIST_HEAD = 3
  sab64[HDR_I64_FREE_LIST_HEAD] = BigInt(0xFFFFFFFF)

  // Attempt allocation
  const ptr = linker.allocNode()

  expect(ptr).toBe(NULL_PTR)
  expect(new Int32Array(sab)[HDR.ERROR_FLAG]).toBe(ERROR.FREE_LIST_CORRUPT)
})
```

**Effort**: Small (15 min)

---

### H-003: Add Test for KERNEL_PANIC (Mutex Timeout)

**Issue**: Mutex deadlock detection never tested.

**Fix Location**: Create new test

**Challenge**: Requires simulating a stuck mutex holder, which is difficult in single-threaded tests.

**Alternative**: Add a method to force timeout for testing:
```typescript
// Test helper (only in development builds)
if (process.env.NODE_ENV === 'test') {
  _testForceDeadlock(): void {
    Atomics.store(this.sab, HDR.CHAIN_MUTEX, CONCURRENCY.MUTEX_LOCKED)
    // Now any mutex acquisition will timeout
  }
}
```

**Effort**: Medium (1 hour)

---

### H-004: Add Tests for Ring Buffer Utility Methods

**Issue**: `isEmpty()`, `isFull()`, `getPendingCount()`, `getCapacity()` untested.

**Fix Location**: Create new test block in `silicon-linker.test.ts`

**Change**:
```typescript
describe('Ring Buffer Utilities', () => {
  it('isEmpty returns true when empty', () => { ... })
  it('isEmpty returns false after write', () => { ... })
  it('isFull returns true at capacity', () => { ... })
  it('getPendingCount tracks unread commands', () => { ... })
  it('getCapacity returns correct value', () => { ... })
})
```

**Effort**: Small (30 min)

---

### H-005: Add Test for INVALID_PTR in executeInsert

**Issue**: Line 1715 `ERROR.INVALID_PTR` setting never tested.

**Fix Location**: `__tests__/stress-tests.test.ts` (already added)

**Verify**: Run test suite.

**Effort**: Done (0 min)

---

## Priority 3: MEDIUM (Fix in Next Sprint)

### M-001: Update SYNAPSE_COUNT Telemetry

**Issue**: `HDR.SYNAPSE_COUNT` is never updated.

**Fix Location**: `synapse-allocator.ts`

**Change**:
```typescript
// In connect():
Atomics.add(this.sab, HDR.SYNAPSE_COUNT, 1)

// In disconnect():
Atomics.add(this.sab, HDR.SYNAPSE_COUNT, -1)

// In compactTable() - reset:
Atomics.store(this.sab, HDR.SYNAPSE_COUNT, liveCount)
```

**Effort**: Small (20 min)

---

### M-002: Use Atomics.load for All Shared Memory Reads

**Issue**: Some reads inside mutex use direct array access instead of Atomics.load.

**Fix Location**: `silicon-synapse.ts:536, 675, 1985, 2019`

**Change**: Replace `this.sab[...]` with `Atomics.load(this.sab, ...)`

**Effort**: Minimal (10 min)

---

### M-003: Add Tests for patchMultiple() and patchSourceId()

**Issue**: These public methods have 0% coverage.

**Fix Location**: `__tests__/silicon-linker.test.ts`

**Effort**: Small (30 min)

---

### M-004: Standardize Loop Style (while vs for-let)

**Issue**: `for (let ...)` in Identity/Symbol Table operations may micro-allocate.

**Fix Location**: `silicon-synapse.ts:1271, 1316, 1355, 1440-1465, 1486-1520`

**Change**: Replace with while loops:
```typescript
// BEFORE:
for (let probe = 0; probe < capacity; probe++) { ... }

// AFTER:
let probe = 0
while (probe < capacity) { ... probe = probe + 1 }
```

**Effort**: Small (20 min)

---

## Priority 4: LOW (Tech Debt)

### L-001: Update HEAP_START_OFFSET Comment

**Issue**: Comment incorrectly describes memory layout calculation.

**Fix Location**: `constants.ts:874-876`

**Change**:
```typescript
/**
 * Calculate byte offset where node heap begins.
 * Header is 42 × i32 fields = 168 bytes (indices 0-41).
 * See HDR.* constants for field definitions.
 */
```

**Effort**: Minimal (5 min)

---

### L-002: Update ISiliconLinker Interface Return Types

**Issue**: `idTableInsert` returns `boolean` but interface shows `void`.

**Fix Location**: `types.ts:144-145`

**Change**:
```typescript
/** Insert sourceId → ptr mapping. Returns true if inserted, false if full. */
idTableInsert(sourceId: number, ptr: NodePtr): boolean
```

**Effort**: Minimal (5 min)

---

### L-003: Rename Test Helper Methods

**Issue**: `insertHead()` / `insertNode()` wrappers expose internal API naming.

**Fix Location**: `silicon-synapse.ts` (test helpers section)

**Change**: Rename to `testInsertHead()` / `testInsertNode()` or add `@internal` JSDoc.

**Effort**: Small (15 min)

---

### L-004: Document Quadratic Probing

**Issue**: Identity Table uses quadratic probing but spec says "linear-probe".

**Option A**: Change implementation to linear probing (spec compliance)
**Option B**: Update spec/comments to document quadratic probing (better performance)

**Recommendation**: Option B - quadratic probing has better clustering characteristics.

**Effort**: Small (15 min for documentation)

---

## Summary

| Priority | Count | Total Effort |
|----------|-------|--------------|
| CRITICAL | 3 | ~50 min |
| HIGH | 5 | ~2 hours |
| MEDIUM | 4 | ~1.5 hours |
| LOW | 4 | ~40 min |
| **TOTAL** | **16** | **~5 hours** |

---

## Recommended Sprint Plan

### Sprint 1 (Current)
- [x] Create stress tests (already done)
- [ ] C-001: Fix Symbol Table probing
- [ ] C-002: Fix executeDelete cleanup
- [ ] C-003: Add MockConsumer warning

### Sprint 2
- [ ] H-002: Test FREE_LIST_CORRUPT
- [ ] H-003: Test KERNEL_PANIC (may defer if complex)
- [ ] H-004: Test Ring Buffer utilities
- [ ] M-001: Update SYNAPSE_COUNT

### Sprint 3 (Tech Debt)
- [ ] M-002 through M-004
- [ ] L-001 through L-004
