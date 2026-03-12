# RFC-059: Kernel Remediation — Silicon Synapse Hardening

**Status**: APPROVED  
**Priority**: HIGH  
**Author**: Architect  
**Created**: 2026-03-12  
**Depends On**: RFC-043 (Silicon Linker), RFC-044 (Command Ring), RFC-045 (Zero-Alloc), RFC-055 (SPSC FreeList)

## 1. Abstract

This RFC addresses eight defects and design gaps identified during a comprehensive audit of the `@symphonyscript/kernel` package. The issues range from a critical data-loss bug (Reclaim Ring overflow) to consistency improvements (Synapse Table probing strategy). All fixes preserve the zero-allocation invariant (RFC-045-04) and the SPSC architecture (RFC-055).

## 2. Summary of Findings

| # | Severity | Title | Files Affected |
|---|----------|-------|----------------|
| R-001 | **CRITICAL** | Reclaim Ring has no overflow check | `silicon-synapse.ts` |
| R-002 | LOW | Dead code: legacy private insert helpers | `silicon-synapse.ts` |
| R-003 | MODERATE | Single error flag (last-writer-wins) | `constants.ts`, all consumers |
| R-004 | LOW | Backpressure ownership clarification | `silicon-bridge.ts` (doc only) |
| R-005 | MODERATE | Unbounded CAS loops in `AttributePatcher` | `patch.ts` |
| R-006 | LOW | `patchMuted` allocates closure | `patch.ts` |
| R-007 | MODERATE | Synapse counters not persisted in SAB | `constants.ts`, `synapse-view.ts`, `synapse-allocator.ts` |
| R-008 | LOW | Synapse Table uses linear probing | `synapse-view.ts`, `synapse-allocator.ts` |

## 3. Specifications

---

### R-001: Reclaim Ring Overflow Check

**Severity**: CRITICAL — Silent data loss (memory leak) under sustained Zone B delete load.

#### 3.1.1 Problem

In `SiliconSynapse._deleteNode()`, when a Zone B node is deleted, its pointer is pushed into the Reclaim Ring for the main thread to recycle. The write path **never checks** if the ring is full. If the main thread is slow to drain, subsequent writes silently overwrite unread entries, permanently leaking node pointers.

The Command Ring (`RingBuffer.write()`) correctly checks `(tail + 1) % capacity === head`. The Reclaim Ring does not.

#### 3.1.2 Current Code (Defective)

```typescript
// silicon-synapse.ts, _deleteNode(), lines 1000-1017
if (ptr >= this.zoneBStartPtr) {
  const tail = Atomics.load(this.sab, HDR.RECLAIM_RB_TAIL)
  const capacity = Atomics.load(this.sab, HDR.RECLAIM_RB_CAPACITY)
  const mask = capacity - 1
  const idx = tail & mask
  const ringDataOffset = Atomics.load(this.sab, HDR.RECLAIM_RING_PTR)
  const ringDataI32 = ringDataOffset / 4
  Atomics.store(this.sab, ringDataI32 + idx, ptr)       // ← UNBOUNDED WRITE
  Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
}
```

#### 3.1.3 Fix

Add a full-check before writing. If the ring is full, set a new error flag (`ERROR.RECLAIM_OVERFLOW`) and skip the write. The pointer is lost (unavoidable without a secondary buffer), but the error is now detectable and actionable.

```typescript
if (ptr >= this.zoneBStartPtr) {
  const tail = Atomics.load(this.sab, HDR.RECLAIM_RB_TAIL)
  const head = Atomics.load(this.sab, HDR.RECLAIM_RB_HEAD)
  const capacity = Atomics.load(this.sab, HDR.RECLAIM_RB_CAPACITY)

  // Full check: (tail - head) >= capacity means all slots occupied
  if ((tail - head) >= capacity) {
    Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.RECLAIM_OVERFLOW)
    // Pointer is lost — this is a memory leak, but detectable.
    // Main thread must drain faster or increase capacity.
  } else {
    const mask = capacity - 1
    const idx = tail & mask
    const ringDataOffset = Atomics.load(this.sab, HDR.RECLAIM_RING_PTR)
    const ringDataI32 = ringDataOffset / 4
    Atomics.store(this.sab, ringDataI32 + idx, ptr)
    Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, tail + 1)
  }
}
```

**Note**: Uses `Atomics.or` per R-003 (bitmask error model).

---

### R-002: Remove Dead Code (Legacy Private Insert Helpers)

**Severity**: LOW — Maintenance liability, no runtime impact.

#### 3.2.1 Problem

The legacy private insert helpers (lines 788–849 and 867–930) were never called. The test helpers `insertHead()` and `insertNode()` route through `ringBuffer.write()` → `processCommands()` → `executeInsert()`. These ~140 lines of dead code:

- Diverge from the actual insert path (`executeInsert`)
- Risk being mistakenly called, bypassing the ring buffer protocol
- Increase cognitive load for readers

#### 3.2.2 Fix

Delete the legacy private insert helpers from `SiliconSynapse`. No callers exist; no tests reference them.

---

### R-003: Bitmask Error Model

**Severity**: MODERATE — Errors are silently clobbered under concurrent faults.

#### 3.3.1 Problem

`HDR.ERROR_FLAG` stores a single integer error code. When multiple errors occur (e.g., `HEAP_EXHAUSTED` + `SAFE_ZONE`), only the last `Atomics.store` persists. Earlier errors are lost with no trace.

#### 3.3.2 Fix

Remap error codes to power-of-2 bit positions. Replace `Atomics.store` with `Atomics.or` for setting, `Atomics.and` for selective clearing.

**New `ERROR` constant (replaces sequential integers):**

```typescript
export const ERROR = {
  OK:                    0,
  HEAP_EXHAUSTED:        1 << 0,   // 0x001
  SAFE_ZONE:             1 << 1,   // 0x002
  INVALID_PTR:           1 << 2,   // 0x004
  KERNEL_PANIC:          1 << 3,   // 0x008
  LOAD_FACTOR_WARNING:   1 << 4,   // 0x010
  FREE_LIST_CORRUPT:     1 << 5,   // 0x020
  UNKNOWN_OPCODE:        1 << 6,   // 0x040
  RING_FULL:             1 << 7,   // 0x080
  SPSC_VIOLATION:        1 << 8,   // 0x100
  RECLAIM_OVERFLOW:      1 << 9,   // 0x200  (NEW: R-001)
  CAS_EXHAUSTION:        1 << 10,  // 0x400  (NEW: R-005)
} as const
```

**Setter pattern (all call sites):**

```typescript
// BEFORE (clobbers):
Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.HEAP_EXHAUSTED)

// AFTER (accumulates):
Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.HEAP_EXHAUSTED)
```

**Getter pattern (all consumers):**

```typescript
// BEFORE:
if (linker.getError() === ERROR.HEAP_EXHAUSTED) { ... }

// AFTER:
if (linker.getError() & ERROR.HEAP_EXHAUSTED) { ... }
```

**Clear pattern:**

```typescript
// Clear all errors:
clearError(): void {
  Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.OK)
}

// Clear specific error bit:
clearErrorBit(bit: number): void {
  Atomics.and(this.sab, HDR.ERROR_FLAG, ~bit)
}
```

**Breaking Change**: All consumers comparing `getError() === ERROR.X` must update to `getError() & ERROR.X`. The "don't clobber" pattern (`if (currentError === ERROR.OK)`) is eliminated — `Atomics.or` is naturally non-clobbering.

---

### R-004: Backpressure Ownership (Documentation)

**Severity**: LOW — Design clarification, no code change required.

#### 3.4.1 Clarification

The kernel (`SiliconSynapse`) is a **consumer** of the ring buffer — it reads and executes commands. Backpressure is correctly the **producer's** responsibility. `SiliconBridge.writeOrSpin()` already implements this:

- Spins up to 500ms retrying `ringBuffer.write()`
- Returns `BRIDGE_ERR.RING_FULL` on timeout
- Sets `ERROR.RING_FULL` in the SAB for cross-thread visibility

The kernel remains a dumb executor by design. This is correct. The `SiliconSynapse` test helpers (`insertHead`, `insertNode`) bypass backpressure, but they are `@internal` and not production paths.

**Action**: No code change. Add a `@remarks` JSDoc block to `RingBuffer.write()` documenting that backpressure is the producer's responsibility, and reference `SiliconBridge.writeOrSpin()` as the canonical implementation.

---

### R-005: Bounded CAS Loops in AttributePatcher

**Severity**: MODERATE — Theoretical infinite spin under pathological contention.

#### 3.5.1 Problem

`casUpdatePackedA()` and `casUpdatePackedAFn()` (to be deleted per R-006) use `while (true)` CAS loops with no exit condition. The chain mutex has `MUTEX_PANIC_THRESHOLD`; these CAS loops have no equivalent.

#### 3.5.2 Fix

Add a constant `CONCURRENCY.CAS_MAX_RETRIES` (value: 64) and use it as the loop bound. On exhaustion, set `ERROR.CAS_EXHAUSTION` via `Atomics.or`.

**New constant:**

```typescript
export const CONCURRENCY = {
  // ... existing fields ...
  /** Maximum CAS retries for attribute patching before declaring failure */
  CAS_MAX_RETRIES: 64
} as const
```

**Updated `casUpdatePackedA`:**

```typescript
private casUpdatePackedA(offset: number, mask: number, shift: number, value: number): void {
  let attempts = 0
  while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
    const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
    const newPacked = (current & ~mask) | ((value << shift) & mask)
    if (newPacked === current) return
    if (Atomics.compareExchange(this.sab, offset + NODE.PACKED_A, current, newPacked) === current) return
    attempts = attempts + 1
  }
  Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
}
```

Same pattern applies to `casSetFlag` and `casClearFlag` (R-006).

---

### R-006: Zero-Allocation `patchMuted`

**Severity**: LOW — Closure allocation violates RFC-045-04 zero-alloc invariant.

#### 3.6.1 Problem

`patchMuted` calls `casUpdatePackedAFn` with an inline arrow function, creating a closure on every invocation:

```typescript
this.casUpdatePackedAFn(offset, (current) =>
  muted ? current | FLAG.MUTED : current & ~FLAG.MUTED
)
```

#### 3.6.2 Fix

1. **Delete** `casUpdatePackedAFn` entirely (single call site, which is the problematic one).
2. **Add** dedicated `casSetFlag` / `casClearFlag` methods (zero-allocation, bounded by `CONCURRENCY.CAS_MAX_RETRIES`).
3. **Rewrite** `patchMuted` to use the branching approach.

```typescript
private casSetFlag(offset: number, flag: number): void {
  let attempts = 0
  while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
    const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
    const updated = current | flag
    if (updated === current) return
    if (Atomics.compareExchange(this.sab, offset + NODE.PACKED_A, current, updated) === current) return
    attempts = attempts + 1
  }
  Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
}

private casClearFlag(offset: number, flag: number): void {
  let attempts = 0
  while (attempts < CONCURRENCY.CAS_MAX_RETRIES) {
    const current = Atomics.load(this.sab, offset + NODE.PACKED_A)
    const updated = current & ~flag
    if (updated === current) return
    if (Atomics.compareExchange(this.sab, offset + NODE.PACKED_A, current, updated) === current) return
    attempts = attempts + 1
  }
  Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.CAS_EXHAUSTION)
}

patchMuted(ptr: NodePtr, muted: boolean): boolean {
  if (!this.validatePtr(ptr)) return false
  const offset = this.nodeOffset(ptr)
  this.bumpSeq(offset)
  if (muted) {
    this.casSetFlag(offset, FLAG.MUTED)
  } else {
    this.casClearFlag(offset, FLAG.MUTED)
  }
  return true
}
```

---

### R-007: Persist Synapse Counters in SAB

**Severity**: MODERATE — Stale counters after SAB reuse (page reload, worker reattach).

#### 3.7.1 Problem

`SynapseView.usedSlots` and `SynapseView.tombstoneCount` are plain JavaScript instance variables. When a `SynapseAllocator` is constructed over a pre-existing SAB, both start at 0, regardless of actual table state. Compaction decisions (`getTombstoneRatio()`, `maybeCompact()`) become unreliable.

#### 3.7.2 Fix

Add two new header fields and read/write them atomically.

**New header fields:**

```typescript
export const HDR = {
  // ... existing fields through ZONE_CONFIG_OFFSET: 43 ...
  /** [R-007] [ATOMIC] Synapse Table: total slots ever used (including tombstones) */
  SYNAPSE_USED_SLOTS: 44,
  /** [R-007] [ATOMIC] Synapse Table: current tombstone count */
  SYNAPSE_TOMBSTONES: 45
} as const
```

**SynapseView constructor** — read initial values from SAB:

```typescript
constructor(buffer: SharedArrayBuffer) {
  // ... existing init ...
  this.usedSlots = Atomics.load(this.sab, HDR.SYNAPSE_USED_SLOTS)
  this.tombstoneCount = Atomics.load(this.sab, HDR.SYNAPSE_TOMBSTONES)
}
```

**SynapseAllocator.connect()** — persist on write:

```typescript
this.usedSlots++
Atomics.store(this.sab, HDR.SYNAPSE_USED_SLOTS, this.usedSlots)
```

**SynapseAllocator.disconnect()** — persist on tombstone:

```typescript
this.tombstoneCount++
Atomics.store(this.sab, HDR.SYNAPSE_TOMBSTONES, this.tombstoneCount)
```

**SynapseAllocator.compactTable()** — reset after compaction:

```typescript
this.usedSlots = liveCount
this.tombstoneCount = 0
Atomics.store(this.sab, HDR.SYNAPSE_USED_SLOTS, liveCount)
Atomics.store(this.sab, HDR.SYNAPSE_TOMBSTONES, 0)
```

**SynapseAllocator.clear()** — reset on clear:

```typescript
clear(): void {
  this.usedSlots = 0
  this.tombstoneCount = 0
  Atomics.store(this.sab, HDR.SYNAPSE_USED_SLOTS, 0)
  Atomics.store(this.sab, HDR.SYNAPSE_TOMBSTONES, 0)
}
```

**Init** — initialize to 0 in `createLinkerSAB`:

```typescript
sab[HDR.SYNAPSE_USED_SLOTS] = 0
sab[HDR.SYNAPSE_TOMBSTONES] = 0
```

---

### R-008: Triangular Probing for Synapse Table

**Severity**: LOW — Consistency with Identity Table; prevents primary clustering at high load.

#### 3.8.1 Problem

The Identity Table uses triangular number probing (Task 078) for guaranteed full-table coverage. The Synapse Table uses linear probing (`slot = (slot + 1) % capacity`), which suffers from primary clustering and is inconsistent with the Identity Table's approach.

#### 3.8.2 Fix

Replace all linear probe sequences in `SynapseView` and `SynapseAllocator` with triangular probing: `slot = (slot + step) & mask; step = step + 1`.

**Affected methods:**

| File | Method | Current | New |
|------|--------|---------|-----|
| `synapse-view.ts` | `findHeadSlot()` | `(slot + 1) % capacity` | `(slot + step) & mask; step++` |
| `synapse-allocator.ts` | `findEmptySlot()` | `(slot + 1) % capacity` | `(slot + step) & mask; step++` |
| `synapse-allocator.ts` | `_insertDirect()` | `(slot + 1) % capacity` | `(slot + step) & mask; step++` |
| `synapse-allocator.ts` | `disconnect()` | chain traversal (no change) | N/A |

**Example (`findHeadSlot`):**

```typescript
public findHeadSlot(sourcePtr: number): number {
  if (sourcePtr === NULL_PTR) return -1
  let slot = this.hash(sourcePtr)
  let step = 1
  let probes = 0
  while (probes < this.capacity) {
    const offset = this.offsetForSlot(slot)
    const storedSource = Atomics.load(this.sab, offset + SYNAPSE.SOURCE_PTR)
    if (storedSource === sourcePtr) return slot
    if (storedSource === NULL_PTR) return -1
    slot = (slot + step) & this.hashMask
    step = step + 1
    probes = probes + 1
  }
  return -1
}
```

**Note:** `disconnect()` traverses a linked chain (via `META_NEXT`), not a probe sequence. It is unaffected.

---

## 4. Implementation Order

Tasks are ordered by severity and dependency:

| Phase | Task | Dependency | Risk |
|-------|------|------------|------|
| 1 | **R-003**: Bitmask error model | None (foundational) | **BREAKING** — all error consumers must update |
| 2 | **R-001**: Reclaim Ring overflow check | R-003 (uses `Atomics.or`) | Critical fix |
| 3 | **R-002**: Delete dead code | None | Trivial |
| 4 | **R-005**: Bounded CAS loops | R-003 (uses `ERROR.CAS_EXHAUSTION`) | Moderate |
| 5 | **R-006**: Zero-alloc `patchMuted` | R-005 (shares bound constant) | Low |
| 6 | **R-007**: Persist synapse counters | None | Moderate (header layout change) |
| 7 | **R-008**: Triangular probing | None | Low (mechanical) |
| 8 | **R-004**: Backpressure docs | None | Doc-only |

## 5. Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| `ERROR` values remapped to bit flags | All `=== ERROR.X` comparisons break | Replace with `& ERROR.X` |
| New `ERROR` codes added | No impact (additive) | N/A |
| Two new HDR fields (44, 45) | SAB layout change | Re-initialize SABs (they are runtime state, not persistent) |
| `clearError()` behavior unchanged | Clears all bits (same as before) | N/A |
| New `clearErrorBit()` method | Additive | N/A |

## 6. Compatibility

- **SAB format**: Not backward compatible. Existing SABs must be re-created. This is acceptable because SABs are ephemeral runtime state.
- **Public API**: `getError()` return value semantics change from enum to bitmask. This is a **breaking change** requiring a minor version bump.
- **Test suite**: All tests comparing `getError() === ERROR.X` must be updated to `getError() & ERROR.X`.

## 7. References

- RFC-043: Silicon Linker (core architecture)
- RFC-044: Command Ring Protocol (Zone A/B, Ring Buffer)
- RFC-045-04: Zero-Allocation Compliance
- RFC-055: SPSC FreeList
- RFC-056: Per-Worker Heap Scaling (multi-zone)
