# RFC-055 SPSC FreeList Implementation Plan

**Status:** PLANNING  
**RFC:** docs/rfcs/055-spsc-freelist.md  
**Priority:** HIGH  
**Created:** 2026-02-01

## 1. Executive Summary

Replace the current MPMC (Multi-Producer Multi-Consumer) 64-bit CAS-based FreeList with a simpler SPSC (Single-Producer Single-Consumer) design using 32-bit atomic load/store operations. This eliminates BigInt allocation on every `alloc()` call.

## 2. Architectural Analysis

### 2.1 Current Implementation (MPMC)

```typescript
// Current: Allocates BigInt on EVERY alloc() call
const newHead = (newVersion << 32n) | BigInt(next)  // ← 16-24 bytes allocation
Atomics.compareExchange(this.sab64, HDR_I64.FREE_LIST_HEAD, head, newHead)
```

**Dependencies:**
- `BigInt64Array` (sab64) for 64-bit atomic operations
- `HDR_I64.FREE_LIST_HEAD` constant (i64 index 3)
- CAS retry loop for thread safety

### 2.2 Target Implementation (SPSC)

```typescript
// New: Zero allocation
const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)
Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, next)
```

**Key Insight:** RFC-044 Zone A/B partitioning guarantees only the Worker thread (AudioWorklet) accesses the FreeList. No concurrent access = no ABA problem = no CAS needed.

## 3. Task Breakdown

### Task 1: Update FreeList.alloc() — SPSC Implementation
**File:** `packages/kernel/src/free-list.ts`  
**Complexity:** MEDIUM

**Changes:**
1. Remove `sab64` parameter from constructor
2. Replace 64-bit CAS loop with 32-bit load/store
3. Use `HDR.FREE_LIST_HEAD_LOW` instead of `HDR_I64.FREE_LIST_HEAD`
4. Remove BigInt operations entirely

**Before:**
```typescript
alloc(): NodePtr {
  while (true) {
    const head = Atomics.load(this.sab64, HDR_I64.FREE_LIST_HEAD)
    const ptr = Number(head & 0xFFFFFFFFn)
    // ... CAS loop with BigInt allocation
  }
}
```

**After:**
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
**Complexity:** MEDIUM

**Changes:**
1. Remove CAS loop
2. Replace 64-bit operations with 32-bit load/store
3. Keep SEQ counter increment (still needed for stale reference detection)

**Before:**
```typescript
free(ptr: NodePtr): void {
  const ptrBigInt = BigInt(ptr)
  while (true) {
    const head = Atomics.load(this.sab64, HDR_I64.FREE_LIST_HEAD)
    // ... CAS loop
  }
}
```

**After:**
```typescript
free(ptr: NodePtr): void {
  if (ptr === NULL_PTR) return
  if (!this.isValidPtr(ptr)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
    return
  }
  const offset = this.nodeOffset(ptr)
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
**Complexity:** LOW

**Changes:**
1. Replace 64-bit read with 32-bit read

**Before:**
```typescript
isEmpty(): boolean {
  const head = Atomics.load(this.sab64, HDR_I64.FREE_LIST_HEAD)
  const ptr = Number(head & 0xFFFFFFFFn)
  return ptr === NULL_PTR
}
```

**After:**
```typescript
isEmpty(): boolean {
  return Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW) === NULL_PTR
}
```

---

### Task 4: Update FreeList.initialize() — 32-bit Head
**File:** `packages/kernel/src/free-list.ts`  
**Complexity:** MEDIUM

**Changes:**
1. Remove `sab64` parameter
2. Initialize `HDR.FREE_LIST_HEAD_LOW` with 32-bit value
3. Remove BigInt initialization

**Before:**
```typescript
static initialize(sab: Int32Array, sab64: BigInt64Array, zoneASize: number, totalCapacity: number): void {
  // ...
  sab64[HDR_I64.FREE_LIST_HEAD] = BigInt(firstNodePtr)
}
```

**After:**
```typescript
static initialize(sab: Int32Array, zoneASize: number, totalCapacity: number): void {
  // ...
  Atomics.store(sab, HDR.FREE_LIST_HEAD_LOW, firstNodePtr)
}
```

---

### Task 5: Update FreeList Constructor — Remove sab64
**File:** `packages/kernel/src/free-list.ts`  
**Complexity:** LOW

**Changes:**
1. Remove `sab64` parameter from constructor
2. Remove `sab64` private field

**Before:**
```typescript
constructor(sab: Int32Array, sab64: BigInt64Array) {
  this.sab = sab
  this.sab64 = sab64
  // ...
}
```

**After:**
```typescript
constructor(sab: Int32Array) {
  this.sab = sab
  // ...
}
```

---

### Task 6: Update init.ts — Remove sab64 from FreeList.initialize()
**File:** `packages/kernel/src/init.ts`  
**Complexity:** LOW

**Changes:**
1. Update `FreeList.initialize()` call to remove `sab64` parameter

**Before:**
```typescript
FreeList.initialize(sab, sab64, zoneASize, cfg.nodeCapacity)
```

**After:**
```typescript
FreeList.initialize(sab, zoneASize, cfg.nodeCapacity)
```

---

### Task 7: Update silicon-synapse.ts — Remove sab64 from FreeList Constructor
**File:** `packages/kernel/src/silicon-synapse.ts`  
**Complexity:** LOW

**Changes:**
1. Update `FreeList` constructor call to remove `sab64` parameter

**Before:**
```typescript
this.freeList = new FreeList(this.sab, this.sab64)
```

**After:**
```typescript
this.freeList = new FreeList(this.sab)
```

---

### Task 8: Add SPSC Invariant Debug Check
**File:** `packages/kernel/src/silicon-synapse.ts`  
**Complexity:** LOW

**Changes:**
1. Add debug-mode assertion in `allocNode()` and `freeNode()` to verify SPSC invariant

```typescript
allocNode(): NodePtr {
  // Debug-mode SPSC invariant check (RFC-055)
  if (process.env.NODE_ENV !== 'production' && !this.isAudioContext) {
    console.error(
      'SPSC VIOLATION: allocNode() called outside Worker context. ' +
      'Use Ring Buffer commands (insertAsync) instead. See RFC-055.'
    )
  }
  // ...
}
```

---

### Task 9: Update Tests — Remove CAS-Specific Tests
**File:** `packages/kernel/src/__tests__/*.test.ts`  
**Complexity:** MEDIUM

**Changes:**
1. Verify all existing tests pass (222+ tests)
2. Remove any tests that specifically test CAS retry behavior
3. Add test that validates SPSC invariant check fires in debug mode

---

### Task 10: Documentation — Update Memory Layout Comments
**File:** `packages/kernel/src/constants.ts`  
**Complexity:** LOW

**Changes:**
1. Update header layout comments to reflect 32-bit head
2. Mark `HDR_I64.FREE_LIST_HEAD` as deprecated (keep for backward compatibility)

## 4. Acceptance Criteria

| Criterion | Verification Method |
|-----------|---------------------|
| ✅ FreeList.alloc() has zero BigInt allocation | Code inspection |
| ✅ FreeList.free() has zero BigInt allocation | Code inspection |
| ✅ No BigInt64Array usage in FreeList class | Code inspection |
| ✅ SPSC invariant check fires in debug mode | Unit test |
| ✅ All existing tests pass (222+ tests) | `npm test` |
| ✅ Memory layout documented (32-bit head) | Code inspection |

## 5. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Run full test suite after each task |
| Memory barrier issues on ARM | Retain `Atomics.load/store` (not plain reads) |
| Stale reference detection | Keep SEQ counter logic intact |

## 6. Execution Order

1. **Task 5** - Update constructor (removes sab64 dependency)
2. **Task 1** - Update alloc() (core SPSC logic)
3. **Task 2** - Update free() (core SPSC logic)
4. **Task 3** - Update isEmpty() (simple change)
5. **Task 4** - Update initialize() (static method)
6. **Task 6** - Update init.ts (caller update)
7. **Task 7** - Update silicon-synapse.ts (caller update)
8. **Task 8** - Add debug check (enhancement)
9. **Task 9** - Update tests (verification)
10. **Task 10** - Update documentation (cleanup)

## 7. Estimated Impact

- **Lines Changed:** ~150
- **Files Modified:** 4-5
- **Test Files Updated:** 1-2
- **Breaking Changes:** Memory layout (SAB must be re-initialized)

---

**Disclaimer:** Awaiting ZERO-TRUST and ZERO-TOLERANCE MANUAL, HOSTILE AND RIGOROUS REVIEW from the architect.
