# RFC-055 SPSC FreeList Implementation Plan — REVISION 1

**Status:** PLANNING (REVISED)  
**RFC:** docs/rfcs/055-spsc-freelist.md  
**Priority:** HIGH  
**Created:** 2026-02-01  
**Revision:** 1 (Architect Defect Fixes)

---

## DEFECT RESOLUTIONS

### D-001 FIX: SEQ.SEQ_SHIFT Verification ✅

**Verification Result:** CONSTANT EXISTS

```typescript
// packages/kernel/src/constants.ts, line 369
export const SEQ = {
  SEQ_SHIFT: 8,
  SEQ_MASK: 0xffffff00,
  FLAGS_EXT_MASK: 0x000000ff
} as const
```

**Status:** No action required. The constant `SEQ.SEQ_SHIFT = 8` is already defined and exported.

---

### D-002 FIX: Revised Execution Order ✅

**Issue:** Original order updated constructor first, breaking `alloc()`/`free()` which still referenced `this.sab64`.

**Corrected Execution Order:**

| Phase | Task | Description | Rationale |
|-------|------|-------------|-----------|
| **Phase 1: Core Methods** | Task 1 | Update `alloc()` to SPSC | Remove sab64 usage from method |
| | Task 2 | Update `free()` to SPSC | Remove sab64 usage from method |
| | Task 3 | Update `isEmpty()` to SPSC | Remove sab64 usage from method |
| | Task 4 | Update `initialize()` to 32-bit | Remove sab64 parameter from static method |
| **Phase 2: Constructor** | Task 5 | Remove sab64 from constructor | Safe now—no methods reference it |
| **Phase 3: Callers** | Task 6 | Update `init.ts` | Remove sab64 from `FreeList.initialize()` call |
| | Task 7 | Update `silicon-synapse.ts` | Remove sab64 from `FreeList` constructor call |
| **Phase 4: Enhancements** | Task 8 | Add SPSC invariant debug check | Enhancement |
| **Phase 5: Verification** | Task 9 | Update tests | Verification |
| | Task 10 | Update documentation | Cleanup |
| | Task 11 | Run benchmarks | Performance verification |

**Git Checkpoint Strategy (W-001 Fix):**
- Commit after Phase 1 completes (Tasks 1-4)
- Commit after Phase 2 completes (Task 5)
- Commit after Phase 3 completes (Tasks 6-7)
- Final commit after Phase 4-5 (Tasks 8-11)

This ensures rollback points at each phase boundary.

---

### D-003 FIX: isAudioContext Property Verification ✅

**Verification Result:** PROPERTY EXISTS

```typescript
// packages/kernel/src/silicon-synapse.ts, line 78
private isAudioContext: boolean = false
```

**Additional Context:**
- Setter: `setAudioContext(isAudio: boolean)` at line 174
- Getter: `getAudioContext(): boolean` at line 191
- Used in mutex acquisition: `_acquireChainMutex()` at line 263
- Used in `poll()`: lines 2109-2111

**Status:** No action required. The property is already implemented with full getter/setter support.

---

## WARNING RESOLUTIONS

### W-001 FIX: Git Checkpoint Strategy ✅

**Strategy:** Commit after each phase (see D-002 Fix above).

Rollback commands if needed:
```bash
# Rollback to before Phase 2
git reset --hard HEAD~1

# Rollback to before Phase 1
git reset --hard HEAD~2
```

---

### W-002 FIX: HDR_I64.FREE_LIST_HEAD Deprecation Strategy ✅

**Decision:** DEPRECATE with JSDoc (do NOT delete)

**Rationale:**
1. Other code may use `BigInt64Array` for different purposes
2. Future features might need 64-bit atomics
3. Deletion could break external tools/debuggers that inspect SAB layout

**Implementation (Task 10):**
```typescript
/**
 * Header register offsets for BigInt64Array access.
 * Use this for 64-bit atomic operations on tagged pointers.
 * 
 * @deprecated FREE_LIST_HEAD is no longer used after RFC-055 SPSC migration.
 * The FreeList now uses HDR.FREE_LIST_HEAD_LOW (32-bit) instead.
 * This constant is retained for backward compatibility and potential future use.
 */
export const HDR_I64 = {
  /** 
   * @deprecated Use HDR.FREE_LIST_HEAD_LOW instead. See RFC-055.
   */
  FREE_LIST_HEAD: 3
} as const
```

---

### W-003 FIX: Benchmark Verification ✅

**Added Task 11: Performance Verification**

**Benchmark Protocol:**
1. Run existing `benchmark.test.ts`
2. Verify `alloc()` latency decreased
3. Verify zero BigInt allocations in hot path

**Expected Results:**
| Metric | MPMC (Before) | SPSC (After) |
|--------|---------------|--------------|
| `alloc()` allocation | 16-24 bytes | 0 bytes |
| `free()` allocation | 0 bytes (hoisted) | 0 bytes |
| CAS retries | Possible | N/A |

---

## UPDATED TASK LIST

### Task 1: Update FreeList.alloc() — SPSC Implementation
**File:** `packages/kernel/src/free-list.ts`  
**Phase:** 1 (Core Methods)

Remove CAS loop, use 32-bit load/store:
```typescript
alloc(): NodePtr {
  const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)
  if (head === NULL_PTR) return NULL_PTR
  if (!this.isValidPtr(head)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
    return NULL_PTR
  }
  const headOffset = this.nodeOffset(head)
  const next = Atomics.load(this.sab, headOffset + NODE.PACKED_A)
  Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, next)
  this.zeroNode(headOffset)
  Atomics.sub(this.sab, HDR.FREE_COUNT, 1)
  return head
}
```

---

### Task 2: Update FreeList.free() — SPSC Implementation
**File:** `packages/kernel/src/free-list.ts`  
**Phase:** 1 (Core Methods)

Remove CAS loop, keep SEQ increment:
```typescript
free(ptr: NodePtr): void {
  if (ptr === NULL_PTR) return
  if (!this.isValidPtr(ptr)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
    return
  }
  const offset = this.nodeOffset(ptr)
  // SEQ.SEQ_SHIFT = 8 (verified in constants.ts line 369)
  Atomics.add(this.sab, offset + NODE.SEQ_FLAGS, 1 << SEQ.SEQ_SHIFT)
  const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)
  Atomics.store(this.sab, offset + NODE.PACKED_A, head)
  Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, ptr)
  Atomics.add(this.sab, HDR.FREE_COUNT, 1)
}
```

---

### Task 3: Update FreeList.isEmpty() — SPSC Implementation
**File:** `packages/kernel/src/free-list.ts`  
**Phase:** 1 (Core Methods)

```typescript
isEmpty(): boolean {
  return Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW) === NULL_PTR
}
```

---

### Task 4: Update FreeList.initialize() — 32-bit Head
**File:** `packages/kernel/src/free-list.ts`  
**Phase:** 1 (Core Methods)

Remove `sab64` parameter, use 32-bit store:
```typescript
static initialize(sab: Int32Array, zoneASize: number, totalCapacity: number): void {
  // ... existing node linking logic ...
  
  // Initialize 32-bit FREE_LIST_HEAD (replaces 64-bit tagged pointer)
  Atomics.store(sab, HDR.FREE_LIST_HEAD_LOW, firstNodePtr)
  
  // ... rest of header initialization ...
}
```

---

### Task 5: Update FreeList Constructor — Remove sab64
**File:** `packages/kernel/src/free-list.ts`  
**Phase:** 2 (Constructor)

```typescript
export class FreeList {
  private sab: Int32Array
  // REMOVED: private sab64: BigInt64Array
  private heapStartI32: number
  private nodeCapacity: number

  constructor(sab: Int32Array) {
    this.sab = sab
    // REMOVED: this.sab64 = sab64
    this.heapStartI32 = HEAP_START_OFFSET / 4
    this.nodeCapacity = sab[HDR.NODE_CAPACITY]
  }
}
```

---

### Task 6: Update init.ts — Remove sab64 from FreeList.initialize()
**File:** `packages/kernel/src/init.ts`  
**Phase:** 3 (Callers)

```typescript
// Before:
FreeList.initialize(sab, sab64, zoneASize, cfg.nodeCapacity)

// After:
FreeList.initialize(sab, zoneASize, cfg.nodeCapacity)
```

Also update `resetLinkerSAB()`:
```typescript
// Before:
FreeList.initialize(sab, sab64, zoneASize, nodeCapacity)

// After:
FreeList.initialize(sab, zoneASize, nodeCapacity)
```

---

### Task 7: Update silicon-synapse.ts — Remove sab64 from FreeList Constructor
**File:** `packages/kernel/src/silicon-synapse.ts`  
**Phase:** 3 (Callers)

```typescript
// Before:
this.freeList = new FreeList(this.sab, this.sab64)

// After:
this.freeList = new FreeList(this.sab)
```

---

### Task 8: Add SPSC Invariant Debug Check
**File:** `packages/kernel/src/silicon-synapse.ts`  
**Phase:** 4 (Enhancements)

```typescript
allocNode(): NodePtr {
  // Debug-mode SPSC invariant check (RFC-055)
  // isAudioContext property verified at line 78 of silicon-synapse.ts
  if (process.env.NODE_ENV !== 'production' && !this.isAudioContext) {
    console.error(
      'SPSC VIOLATION: allocNode() called outside Worker context. ' +
      'Use Ring Buffer commands (insertAsync) instead. See RFC-055.'
    )
  }
  const ptr = this.freeList.alloc()
  // ... rest of method
}
```

---

### Task 9: Update Tests
**File:** `packages/kernel/src/__tests__/*.test.ts`  
**Phase:** 5 (Verification)

1. Run full test suite: `npm test`
2. Verify all 222+ tests pass
3. Remove any CAS-specific tests (if any exist)
4. Add SPSC invariant test (optional)

---

### Task 10: Update Documentation
**File:** `packages/kernel/src/constants.ts`  
**Phase:** 5 (Verification)

Add deprecation JSDoc to `HDR_I64` (see W-002 Fix above).

---

### Task 11: Run Benchmarks (NEW)
**File:** `packages/kernel/src/__tests__/benchmark.test.ts`  
**Phase:** 5 (Verification)

```bash
npm test -- --grep "benchmark"
```

Verify:
- `alloc()` shows no BigInt allocation overhead
- Performance is equal or better than MPMC implementation

---

## ACCEPTANCE CRITERIA (UPDATED)

| Criterion | Verification Method |
|-----------|---------------------|
| ✅ FreeList.alloc() has zero BigInt allocation | Code inspection |
| ✅ FreeList.free() has zero BigInt allocation | Code inspection |
| ✅ No BigInt64Array usage in FreeList class | Code inspection |
| ✅ SPSC invariant check fires in debug mode | Manual test or unit test |
| ✅ All existing tests pass (222+ tests) | `npm test` |
| ✅ Memory layout documented (32-bit head) | Code inspection |
| ✅ HDR_I64 deprecated with JSDoc | Code inspection |
| ✅ Benchmarks show no regression | `npm test -- --grep "benchmark"` |

---

**Disclaimer:** Awaiting ZERO-TRUST and ZERO-TOLERANCE MANUAL, HOSTILE AND RIGOROUS REVIEW from the architect.
