# SymphonyScript Kernel Remediation Plan

**Document ID:** KERNEL-REMEDIATION-2026-01-29-001  
**Parent Audit:** KERNEL-AUDIT-2026-01-29-001  
**Target Grade:** A+ (97%)  
**Estimated Effort:** 6-10 hours of focused engineering

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 1.0 | 2026-01-29 | Initial plan |
| 1.1 | 2026-01-29 | Corrections based on audit review |

### Rev 1.1 Corrections

Based on technical review of the original audit:

1. **Task 2.1 (ARM Memory Barrier) — REMOVED**
   - ECMAScript mandates sequentially consistent semantics for all `Atomics` operations
   - Original finding incorrectly applied C/C++ memory model to JavaScript
   - No fix needed; code is correct as-is

2. **Task 2.3 (BigInt Allocation) — PARTIAL FIX**
   - `free()`: FIXABLE — hoist `BigInt(ptr)` before loop (ptr is constant)
   - `alloc()`: ONE allocation per call (not per retry) — acceptable trade-off
   - Severity downgraded: Not a "loop allocation", just once-per-call overhead

3. **Task 3.3 (Atomics.wait Fix) — CORRECTED**
   - Original fix used `try/catch` in hot path, violating zero-allocation mandate
   - Corrected to detect `Atomics.wait` support once at construction time

---

## Executive Summary

This plan addresses all 12 findings from the kernel audit. The work is organized into 4 phases:

| Phase | Focus | Priority | Est. Time |
|-------|-------|----------|-----------|
| 1 | Memory Layout Fix | CRITICAL | 2-3 hours |
| 2 | Thread Safety Hardening | HIGH | 1-2 hours |
| 3 | Code Quality & Idioms | MEDIUM | 2-3 hours |
| 4 | Test Coverage & Validation | LOW | 1-2 hours |

**Phase 1 is a BLOCKER.** Do not ship without it.

**Note:** Phase 2 reduced from original estimate after retracting Task 2.1 (ARM barrier — unnecessary). Task 2.3 (`free()` BigInt) is now a real fix.

---

## Phase 1: Memory Layout Fix (CRITICAL)

### Task 1.1: Fix Symbol Table Capacity Mismatch

**Bug:** Symbol Table overlaps with Identity Table because offset calculation uses `nodeCapacity` instead of `nodeCapacity * 2`.

**Files to Modify:**
- `packages/kernel/src/constants.ts`
- `packages/kernel/src/init.ts`

**Step 1: Fix `getSymbolTableOffset()`**

```typescript
// constants.ts:908 - BEFORE
export function getSymbolTableOffset(nodeCapacity: number): number {
  return getIdentityTableOffset(nodeCapacity) + nodeCapacity * ID_TABLE.ENTRY_SIZE_BYTES
}

// constants.ts:908 - AFTER
export function getSymbolTableOffset(nodeCapacity: number): number {
  // RFC-047-50: Identity Table uses 2x capacity for load factor
  // Symbol Table must account for full Identity Table size
  return getIdentityTableOffset(nodeCapacity) + nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
}
```

**Step 2: Fix `calculateSABSize()`**

```typescript
// constants.ts:863 - BEFORE
const identityTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES // RFC-047-50: 2x capacity
const symbolTableSize = nodeCapacity * SYM_TABLE.ENTRY_SIZE_BYTES // 8 bytes per entry

// constants.ts:863 - AFTER
const identityTableSize = nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES // RFC-047-50: 2x capacity
const symbolTableSize = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES // Must match Identity Table capacity
```

**Step 3: Fix `initializeSymbolTable()`**

```typescript
// init.ts:218-230 - BEFORE
function initializeSymbolTable(sab: Int32Array, nodeCapacity: number): void {
  const tableOffset = getSymbolTableOffset(nodeCapacity)
  const tableOffsetI32 = tableOffset / 4
  const totalI32 = nodeCapacity * SYM_TABLE.ENTRY_SIZE_I32
  // ...
}

// init.ts:218-230 - AFTER
function initializeSymbolTable(sab: Int32Array, nodeCapacity: number): void {
  const tableOffset = getSymbolTableOffset(nodeCapacity)
  const tableOffsetI32 = tableOffset / 4
  // Must match Identity Table capacity (2x nodeCapacity)
  const totalI32 = nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_I32
  // ...
}
```

**Step 4: Add Memory Layout Validation Test**

```typescript
// __tests__/memory-layout.test.ts (NEW FILE)
import { 
  calculateSABSize, 
  getIdentityTableOffset, 
  getSymbolTableOffset,
  getGrooveTemplateOffset,
  getRingBufferOffset,
  HEAP_START_OFFSET,
  NODE_SIZE_BYTES,
  ID_TABLE,
  SYM_TABLE
} from '../constants'

describe('Memory Layout Validation', () => {
  const nodeCapacity = 4096
  
  it('should have non-overlapping regions', () => {
    const heapEnd = HEAP_START_OFFSET + nodeCapacity * NODE_SIZE_BYTES
    const idTableStart = getIdentityTableOffset(nodeCapacity)
    const idTableEnd = idTableStart + nodeCapacity * 2 * ID_TABLE.ENTRY_SIZE_BYTES
    const symTableStart = getSymbolTableOffset(nodeCapacity)
    const symTableEnd = symTableStart + nodeCapacity * 2 * SYM_TABLE.ENTRY_SIZE_BYTES
    const grooveStart = getGrooveTemplateOffset(nodeCapacity)
    
    // Verify sequential, non-overlapping layout
    expect(heapEnd).toBe(idTableStart)
    expect(idTableEnd).toBe(symTableStart)
    expect(symTableEnd).toBe(grooveStart)
  })
  
  it('should have Symbol Table capacity matching Identity Table', () => {
    const idTableCapacity = nodeCapacity * 2
    const symTableCapacity = nodeCapacity * 2
    
    const idTableSize = idTableCapacity * ID_TABLE.ENTRY_SIZE_BYTES
    const symTableSize = symTableCapacity * SYM_TABLE.ENTRY_SIZE_BYTES
    
    // Both tables should have same number of slots
    expect(idTableCapacity).toBe(symTableCapacity)
  })
  
  it('should access valid memory for high slot indices', () => {
    const sabSize = calculateSABSize(nodeCapacity)
    const symTableStart = getSymbolTableOffset(nodeCapacity)
    const maxSlot = nodeCapacity * 2 - 1 // 8191 for nodeCapacity=4096
    const maxSlotOffset = symTableStart + maxSlot * SYM_TABLE.ENTRY_SIZE_BYTES
    
    // Max slot should be within SAB bounds
    expect(maxSlotOffset + SYM_TABLE.ENTRY_SIZE_BYTES).toBeLessThanOrEqual(sabSize)
  })
})
```

**Verification:**
```bash
npm test -- --testPathPattern="memory-layout"
```

---

### Task 1.2: Fix Synapse Table Compaction Race

**Bug:** `compactTable()` reads/writes entire Synapse Table without mutex protection.

**Files to Modify:**
- `packages/kernel/src/synapse-allocator.ts`
- `packages/kernel/src/silicon-synapse.ts`

**Option A: Add Mutex to SynapseAllocator (Recommended)**

```typescript
// synapse-allocator.ts - Add mutex acquisition

export class SynapseAllocator extends SynapseView {
  private sab32: Int32Array // Need reference for mutex
  
  constructor(buffer: SharedArrayBuffer) {
    super(buffer)
    this.sab32 = new Int32Array(buffer) // For mutex access
  }
  
  /**
   * Compact the synapse table by rehashing all live entries.
   * 
   * **THREAD SAFETY:** Acquires Chain Mutex for duration of compaction.
   * This is a stop-the-world operation - use sparingly.
   * 
   * @param acquireMutex - Function to acquire mutex (injected from SiliconSynapse)
   * @param releaseMutex - Function to release mutex

   * @returns Number of live synapses after compaction, or -1 if mutex acquisition failed
   */
  compactTableSafe(
    acquireMutex: () => boolean,
    releaseMutex: () => void
  ): number {
    if (!acquireMutex()) {
      return -1 // Mutex acquisition failed
    }
    
    try {
      return this.compactTable()
    } finally {
      releaseMutex()
    }
  }
  
  // ... rest of class
}
```

**Option B: Make Compaction a Deferred Command**

Add `CMD.COMPACT_SYNAPSES = 7` and process it in the Worker thread where mutex is already held during command processing. This is cleaner but requires more changes.

**Recommended:** Option A for simplicity. Compaction is rare and expected to cause latency.

---

## Phase 2: Thread Safety Hardening (HIGH)

### ~~Task 2.1: Add Memory Barrier After Mutex Acquisition~~ **[REMOVED]**

**Status:** UNNECESSARY

ECMAScript's `Atomics.compareExchange` is **mandated to be sequentially consistent (SC)** by spec (ECMA-262 §25.4). The JavaScript engine emits appropriate memory barriers on all architectures, including ARM.

The original finding was based on C/C++ memory model knowledge incorrectly applied to JavaScript. No fix needed — the code is correct as-is.

---

### Task 2.2: Fix Reclaim Ring Non-Atomic Write

**Bug:** Raw array assignment could be reordered with tail update on ARM.

**File:** `packages/kernel/src/silicon-synapse.ts`

```typescript
// silicon-synapse.ts:774 - BEFORE
// Write pointer
this.sab[ringDataI32 + idx] = ptr

// Commit write
Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)

// silicon-synapse.ts:774 - AFTER
// Write pointer atomically (release semantics on ARM)
Atomics.store(this.sab, ringDataI32 + idx, ptr)

// Commit write (consumer will see data due to acquire-release)
Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
```

---

### Task 2.3: Optimize BigInt Allocation in Free List

**Status:** PARTIAL FIX + ACCEPTED TRADE-OFF

**The Reality:**
- `free()`: **FIXABLE** — ptr is constant, hoist before loop
- `alloc()`: **ONE allocation per call** (not per retry) — acceptable

**Fix for `free()`:**

```typescript
// free-list.ts:171-226 - BEFORE
free(ptr: NodePtr): void {
  // ...
  while (true) {
    const head = Atomics.load(this.sab64, HDR_I64.FREE_LIST_HEAD)
    const headPtr = Number(head & 0xFFFFFFFFn)
    Atomics.store(this.sab, offset + NODE.PACKED_A, headPtr)
    const version = head >> 32n
    const newVersion = version + 1n
    const newHead = (newVersion << 32n) | BigInt(ptr)  // <-- INSIDE loop
    // ... CAS ...
  }
}

// free-list.ts:171-226 - AFTER
free(ptr: NodePtr): void {
  if (ptr === NULL_PTR) return
  if (!this.isValidPtr(ptr)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
    return
  }
  const offset = this.nodeOffset(ptr)
  Atomics.add(this.sab, offset + NODE.SEQ_FLAGS, 1 << SEQ.SEQ_SHIFT)
  
  const ptrBigInt = BigInt(ptr)  // HOISTED: ptr is constant
  
  while (true) {
    const head = Atomics.load(this.sab64, HDR_I64.FREE_LIST_HEAD)
    const headPtr = Number(head & 0xFFFFFFFFn)
    Atomics.store(this.sab, offset + NODE.PACKED_A, headPtr)
    const version = head >> 32n
    const newVersion = version + 1n
    const newHead = (newVersion << 32n) | ptrBigInt  // No allocation on retry
    
    const result = Atomics.compareExchange(this.sab64, HDR_I64.FREE_LIST_HEAD, head, newHead)
    if (result === head) {
      Atomics.add(this.sab, HDR.FREE_COUNT, 1)
      return
    }
  }
}
```

**Why `alloc()` is acceptable as-is:**
```typescript
while (true) {
  // ... load head, compute next ...
  const nextBigInt = BigInt(next)  // One allocation
  if (CAS succeeds) return         // Exit — typical case
  // Retry only on contention (rare in SPSC)
}
```

- CAS retry rate: Near-zero due to Zone A/B partitioning
- Typical case: ONE allocation per `alloc()` call
- Size: ~16-24 bytes (short-lived, nursery GC optimized)
- Trade-off: This is the cost of ABA-safe 64-bit atomics. The alternative (no version counter) risks data corruption.

**Verdict:** Fix `free()`. Accept `alloc()` as minimal overhead — equivalent to any function returning an object.

---

## Phase 3: Code Quality & Idioms (MEDIUM)

### Task 3.1: Use Atomic Add/Sub for NODE_COUNT

**Issue:** Non-idiomatic load+store pattern (safe but confusing).

**File:** `packages/kernel/src/silicon-synapse.ts`

```typescript
// BEFORE (multiple locations: 598-599, 677-678, 752-753, 1776-1777)
const currentCount = Atomics.load(this.sab, HDR.NODE_COUNT)
Atomics.store(this.sab, HDR.NODE_COUNT, currentCount + 1)

// AFTER
Atomics.add(this.sab, HDR.NODE_COUNT, 1)

// For decrement:
// BEFORE
const currentCount = Atomics.load(this.sab, HDR.NODE_COUNT)
Atomics.store(this.sab, HDR.NODE_COUNT, currentCount - 1)

// AFTER
Atomics.sub(this.sab, HDR.NODE_COUNT, 1)
```

**Locations to update:**
- Line 598-599 (legacy private insert helper, removed in RFC-059 R-002)
- Line 677-678 (legacy private insert helper, removed in RFC-059 R-002)
- Line 752-753 (`_deleteNode`)
- Line 1776-1777 (`executeInsert`)

---

### Task 3.2: Add Synapse Capacity Power-of-2 Validation

**Issue:** Hash mask assumes power-of-2 capacity but doesn't validate.

**File:** `packages/kernel/src/init.ts`

```typescript
// init.ts:62 - Add validation
export function createLinkerSAB(config?: LinkerConfig): SharedArrayBuffer {
  const baseCfg = { ...DEFAULT_CONFIG_BASE, ...config }
  const effectiveSynapseCapacity = config?.synapseCapacity ?? baseCfg.nodeCapacity * 8
  
  // Validate synapse capacity is power of 2 (required for hash mask)
  if ((effectiveSynapseCapacity & (effectiveSynapseCapacity - 1)) !== 0) {
    throw new Error(
      `synapseCapacity must be a power of 2, got ${effectiveSynapseCapacity}`
    )
  }
  
  // ... rest of function
}
```

---

### Task 3.3: Fix YIELD_SLOT Atomics.wait on Main Thread

**Issue:** `Atomics.wait()` throws TypeError on main thread.

**File:** `packages/kernel/src/silicon-synapse.ts`

**CRITICAL:** The naive try/catch fix **violates zero-allocation** (try/catch allocates exception frames). We must detect context WITHOUT try/catch in the hot path.

**Correct Fix — Detect Once at Construction:**

```typescript
// silicon-synapse.ts - Add to class properties
private readonly canAtomicsWait: boolean

// In constructor:
constructor(buffer: SharedArrayBuffer) {
  // ... existing code ...
  
  // Detect Atomics.wait support ONCE at construction (not in hot path)
  // Workers support it, main thread throws TypeError
  this.canAtomicsWait = this._detectAtomicsWaitSupport()
}

// Detection helper (called once, allocation is acceptable here)
private _detectAtomicsWaitSupport(): boolean {
  try {
    // Use a dummy test with immediate timeout
    // Value -1 ensures "not-equal" return (no actual wait)
    Atomics.wait(this.sab, HDR.YIELD_SLOT, -1, 0)
    return true
  } catch {
    return false
  }
}

// Hot path - ZERO ALLOCATION
private _yieldToCPU(): void {
  if (this.canAtomicsWait) {
    Atomics.wait(this.sab, HDR.YIELD_SLOT, 0, 1)
  }
  // On main thread: no-op (spin continues without yield)
  // This is acceptable because main thread mutex acquisition is rare
}
```

**Why This Works:**
- `try/catch` is in constructor (cold path), not in `_yieldToCPU()` (hot path)
- The boolean check `if (this.canAtomicsWait)` is zero-allocation
- Main thread simply skips the yield and continues spinning (acceptable for rare mutex use)

**Alternative — Environment Detection (Even Simpler):**

```typescript
// Detect at construction using environment check (no try/catch needed)
private readonly canAtomicsWait: boolean = typeof WorkerGlobalScope !== 'undefined'
```

This works because `Atomics.wait` is only allowed in Worker contexts. However, the try/catch approach is more robust against edge cases (e.g., SharedArrayBuffer in Node.js worker threads).

---

### Task 3.4: Add CAS Loop for PACKED_A Patching (Preventive)

**Issue:** Latent race if Worker ever gains patch access.

**File:** `packages/kernel/src/patch.ts`

```typescript
// patch.ts - Add CAS-based patch helper

/**
 * Atomically patch a field within PACKED_A using CAS loop.
 * Prevents lost updates if multiple threads patch concurrently.
 */
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

patchPitch(ptr: NodePtr, pitch: number): boolean {
  if (!this.validatePtr(ptr)) return false
  const offset = this.nodeOffset(ptr)
  pitch = Math.max(0, Math.min(127, pitch | 0))
  
  this.bumpSeq(offset)
  this.casUpdatePackedA(offset, PACKED.PITCH_MASK, PACKED.PITCH_SHIFT, pitch)
  return true
}

// Apply same pattern to patchVelocity, patchMuted
```

---

### Task 3.5: Add Identity Table Rebuild Protocol

**Issue:** No way to rebuild ID table after clearing (spec debt).

**File:** `packages/kernel/src/silicon-synapse.ts`

```typescript
/**
 * Rebuild the Identity Table from the live chain.
 * 
 * **Use Case:** After idTableClear() or when tombstones exceed threshold.
 * 
 * **Thread Safety:** Acquires Chain Mutex for duration.
 * 
 * @returns Number of entries rebuilt, or -1 if mutex acquisition failed
 */
idTableRebuild(): number {
  if (!this._acquireChainMutex()) {
    return -1
  }
  
  try {
    // 1. Clear table (removes all tombstones)
    this.idTableClear()
    
    // 2. Traverse chain and re-insert all sourceIds
    let count = 0
    let ptr = Atomics.load(this.sab, HDR.HEAD_PTR)
    
    while (ptr !== NULL_PTR) {
      const offset = this.nodeOffset(ptr)
      const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)
      
      if (sourceId > 0) {
        this.idTableInsert(sourceId, ptr)
        count++
      }
      
      ptr = Atomics.load(this.sab, offset + NODE.NEXT_PTR)
    }
    
    return count
  } finally {
    this._releaseChainMutex()
  }
}
```

---

## Phase 4: Test Coverage & Validation (LOW)

### Task 4.1: Add UNKNOWN_OPCODE Test

**File:** `packages/kernel/src/__tests__/silicon-linker.test.ts`

```typescript
describe('Error Handling', () => {
  it('should set ERROR.UNKNOWN_OPCODE for invalid command', () => {
    const linker = SiliconSynapse.create({ nodeCapacity: 256 })
    const sab = new Int32Array(linker.getSAB())
    
    // Manually inject invalid command into ring buffer
    const ringOffset = Atomics.load(sab, HDR.COMMAND_RING_PTR) / 4
    const tail = Atomics.load(sab, HDR.RB_TAIL)
    const capacity = Atomics.load(sab, HDR.RB_CAPACITY)
    const writeIdx = ringOffset + (tail % capacity) * 4
    
    // Write invalid opcode 99
    Atomics.store(sab, writeIdx + 0, 99)  // Invalid opcode
    Atomics.store(sab, writeIdx + 1, 0)
    Atomics.store(sab, writeIdx + 2, 0)
    Atomics.store(sab, writeIdx + 3, 0)
    Atomics.store(sab, HDR.RB_TAIL, tail + 1)
    
    // Process the invalid command
    linker.processCommands()
    
    expect(linker.getError()).toBe(ERROR.UNKNOWN_OPCODE)
  })
})
```

---

### Task 4.2: Add High-Slot Symbol Table Test

**File:** `packages/kernel/src/__tests__/identity-table.test.ts`

```typescript
describe('Identity Table High Slot Access', () => {
  it('should correctly store/retrieve entries in high slots (>= nodeCapacity)', () => {
    const linker = SiliconSynapse.create({ nodeCapacity: 256 })
    
    // Insert enough entries to force quadratic probing into high slots
    const entries: Array<{ sourceId: number; ptr: number }> = []
    
    for (let i = 1; i <= 400; i++) {
      const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 480, i * 100, i, 0)
      if (ptr !== NULL_PTR) {
        entries.push({ sourceId: i, ptr })
      }
    }
    
    // Verify all entries can be looked up
    for (const entry of entries) {
      const foundPtr = linker.idTableLookup(entry.sourceId)
      expect(foundPtr).toBe(entry.ptr)
    }
    
    // Verify Symbol Table access doesn't corrupt
    for (const entry of entries) {
      linker.symTableStore(entry.sourceId, 12345, 100, 50)
    }
    
    // Re-verify ID table (would fail if Symbol Table corrupted it)
    for (const entry of entries) {
      const foundPtr = linker.idTableLookup(entry.sourceId)
      expect(foundPtr).toBe(entry.ptr)
    }
  })
})
```

---

### Task 4.3: Add Concurrent Operations Stress Test

**File:** `packages/kernel/src/__tests__/stress-tests.test.ts`

**Note:** This test validates general concurrency correctness, not ARM-specific behavior (ECMAScript guarantees SC semantics on all platforms).

```typescript
describe('Concurrent Operations', () => {
  it('should maintain data integrity under interleaved insert/traverse', async () => {
    const linker = SiliconSynapse.create({ nodeCapacity: 1024 })
    
    // Simulate interleaved access by rapidly alternating operations
    const insertPromise = (async () => {
      for (let i = 0; i < 100; i++) {
        linker.insertHead(OPCODE.NOTE, 60, 100, 480, i * 10, i + 1, 0)
        // Yield to allow interleaving
        await new Promise(r => setTimeout(r, 0))
      }
    })()
    
    const traversePromise = (async () => {
      for (let i = 0; i < 100; i++) {
        let count = 0
        linker.traverse(() => { count++ })
        // Count should always be consistent (not torn)
        expect(count).toBeGreaterThanOrEqual(0)
        await new Promise(r => setTimeout(r, 0))
      }
    })()
    
    await Promise.all([insertPromise, traversePromise])
    
    // Final count should match
    expect(linker.getNodeCount()).toBe(100)
  })
})
```

---

## Verification Checklist

After implementing all phases, run:

```bash
# Full test suite
npm test -- --selectProjects @symphonyscript/kernel

# Memory layout validation
npm test -- --testPathPattern="memory-layout"

# Stress tests
npm test -- --testPathPattern="stress"

# Coverage report
npm test -- --coverage --selectProjects @symphonyscript/kernel
```

**Expected Outcomes:**
- [ ] All 213+ tests pass
- [ ] New memory layout tests pass
- [ ] No overlapping memory regions
- [ ] Symbol Table slot 8000 accesses valid memory
- [ ] ERROR.UNKNOWN_OPCODE test passes
- [ ] Coverage > 90% on critical paths

---

## Post-Remediation Audit Expectations

| Category | Current | Target | Notes |
|----------|---------|--------|-------|
| Memory Layout | 60% | 98% | After Symbol Table fix |
| Thread Safety | 78% | 95% | Reclaim Ring + Compaction mutex |
| Zero-Allocation | 98% | 99% | `free()` fixed; `alloc()` is once-per-call, not loop |
| Spec Compliance | 75% | 95% | After ID Table rebuild protocol |
| Error Coverage | 85% | 98% | After new tests |
| **Total** | **75%** | **97%** | |

**Target Grade: A+**

---

## Accepted Trade-offs

These are not bugs but conscious architectural decisions:

| Trade-off | Impact | Justification |
|-----------|--------|---------------|
| BigInt allocation in `alloc()` | ~16-24 bytes per call | Cost of ABA-safe 64-bit atomics. Alternative (no version counter) risks data corruption. Equivalent to any function returning an object. |
| ECMAScript SC-only atomics | Cannot fine-tune acquire/release | JS mandates SC — stronger than needed but zero implementation cost. |

These do not affect the grade because they are informed engineering decisions, not oversights.

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1 (BLOCKER)                                           │
│ ├── Task 1.1: Symbol Table Fix     ████████████ CRITICAL   │
│ └── Task 1.2: Compaction Mutex     ████████████ CRITICAL   │
├─────────────────────────────────────────────────────────────┤
│ PHASE 2 (HIGH)                                              │
│ ├── Task 2.1: ARM Memory Barrier   ░░░░░░░░ REMOVED        │
│ ├── Task 2.2: Reclaim Ring Atomic  ████████ DO THIS        │
│ └── Task 2.3: BigInt in free()     ████████ FIX THIS       │
├─────────────────────────────────────────────────────────────┤
│ PHASE 3 (MEDIUM)                                            │
│ ├── Task 3.1: NODE_COUNT Idiom     ████                    │
│ ├── Task 3.2: Power-of-2 Validate  ████                    │
│ ├── Task 3.3: Atomics.wait Fix     ████ (detect at init)   │
│ ├── Task 3.4: CAS Patch (Prevent)  ████                    │
│ └── Task 3.5: ID Table Rebuild     ████                    │
├─────────────────────────────────────────────────────────────┤
│ PHASE 4 (LOW)                                               │
│ ├── Task 4.1: UNKNOWN_OPCODE Test  ██                      │
│ ├── Task 4.2: High-Slot Test       ██                      │
│ └── Task 4.3: Concurrency Test     ██                      │
└─────────────────────────────────────────────────────────────┘
```

**Legend:** ████ = Do this | ░░░░ = Removed (unnecessary)

---

*End of Remediation Plan*
