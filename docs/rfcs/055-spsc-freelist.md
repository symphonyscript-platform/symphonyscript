# RFC-055: SPSC FreeList (Zero-Allocation Memory Management)

**Status**: PROPOSED  
**Priority**: HIGH  
**Author**: Architect  
**Created**: 2026-01-28  
**Depends On**: RFC-044 (Zone A/B Partitioning)

## 1. Abstract

This RFC proposes replacing the current MPMC (Multi-Producer Multi-Consumer) lock-free FreeList implementation with a simpler SPSC (Single-Producer Single-Consumer) design. The current implementation uses 64-bit BigInt CAS operations that allocate memory on every `alloc()` call. By committing to the architectural invariant that only the AudioWorklet thread accesses the FreeList, we can eliminate this allocation entirely.

## 2. Motivation

### 2.1 Current Implementation Cost

The current FreeList uses 64-bit tagged pointers to prevent the ABA problem:

```typescript
// Current: Allocates BigInt on EVERY alloc() call
const newHead = (newVersion << 32n) | BigInt(next)  // ← 16-24 bytes allocation
Atomics.compareExchange(this.sab64, HDR_I64.FREE_LIST_HEAD, head, newHead)
```

This allocation:
- Creates GC pressure in the hot path
- Is unavoidable with JavaScript's lack of native 64-bit integers
- Exists as "insurance" against multi-threaded FreeList access

### 2.2 Architectural Reality

RFC-044 established the Zone A/B partitioning:

| Component | Writes to FreeList | Reads from FreeList |
|-----------|-------------------|---------------------|
| Main Thread (SiliconBridge) | ❌ No | ❌ No |
| Worker (SiliconSynapse) | ✅ Yes | ✅ Yes |
| AudioWorklet | ❌ No (read-only traverse) | ❌ No |

The Main Thread writes **commands to the Ring Buffer**, not directly to the FreeList. Only the Worker thread (which runs `processCommands()` / `poll()`) accesses the FreeList.

**The MPMC CAS is paying for insurance that's never claimed.**

### 2.3 Opportunity

If we commit to SPSC semantics with a documented and enforced invariant, we can:
- Eliminate BigInt allocation entirely
- Remove version counter overhead
- Simplify the code significantly

## 3. Specification

### 3.1 The SPSC Invariant

**INVARIANT: The FreeList is only accessed by the Worker thread (which runs `processCommands()`).**

This means:
- `alloc()` is only called from `SiliconSynapse.allocNode()` during `processCommands()` / `poll()`
- `free()` is only called from `SiliconSynapse.freeNode()` during command processing or reclamation

No other thread may call `alloc()` or `free()` directly.

**Clarification:** The AudioWorklet calls `poll()` which internally runs `processCommands()`. The AudioWorklet thread IS the Worker thread in production. The Main Thread writes commands to the Ring Buffer but never touches the FreeList.

### 3.2 Runtime Enforcement

To catch violations early, add a debug-mode assertion using the existing `isAudioContext` flag:

```typescript
// In SiliconSynapse.allocNode() and freeNode()
allocNode(): NodePtr {
  // Debug-mode SPSC invariant check
  if (process.env.NODE_ENV !== 'production' && !this.isAudioContext) {
    console.error(
      'SPSC VIOLATION: allocNode() called outside Worker context. ' +
      'Use Ring Buffer commands (insertAsync) instead. See RFC-055.'
    )
  }
  return this.freeList.alloc()
}
```

**Note:** `isAudioContext` is `true` when running inside `poll()` (AudioWorklet's `process()` callback). It's `false` on the Main Thread. This existing flag provides the invariant check without introducing new state.

### 3.3 New FreeList Implementation

Replace the 64-bit CAS with simple atomic load/store:

```typescript
/**
 * SPSC FreeList - Zero allocation memory management.
 * 
 * INVARIANT: Only the AudioWorklet thread may call alloc() or free().
 * Violation will cause data corruption. See RFC-055.
 */
export class FreeList {
  private sab: Int32Array
  private heapStartI32: number
  private nodeCapacity: number

  // No sab64 needed - we don't use 64-bit atomics anymore

  /**
   * Allocate a node from the free list.
   * 
   * SPSC: No CAS needed. Simple load → read next → store.
   * Zero allocation.
   */
  alloc(): NodePtr {
    // Load current head (memory barrier for visibility)
    const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)

    // Heap exhausted
    if (head === NULL_PTR) {
      return NULL_PTR
    }

    // Validate pointer
    if (!this.isValidPtr(head)) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return NULL_PTR
    }

    const headOffset = this.nodeOffset(head)

    // Read the next pointer from the free node
    const next = Atomics.load(this.sab, headOffset + NODE.PACKED_A)

    // Update head (memory barrier for visibility)
    Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, next)

    // Zero the node
    this.zeroNode(headOffset)

    // Update counters
    Atomics.sub(this.sab, HDR.FREE_COUNT, 1)

    return head
  }

  /**
   * Return a node to the free list.
   * 
   * SPSC: No CAS needed. Simple store → load → store.
   * Zero allocation.
   */
  free(ptr: NodePtr): void {
    if (ptr === NULL_PTR) return

    if (!this.isValidPtr(ptr)) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.FREE_LIST_CORRUPT)
      return
    }

    const offset = this.nodeOffset(ptr)

    // Increment SEQ counter for stale reference detection
    Atomics.add(this.sab, offset + NODE.SEQ_FLAGS, 1 << SEQ.SEQ_SHIFT)

    // Load current head
    const head = Atomics.load(this.sab, HDR.FREE_LIST_HEAD_LOW)

    // Point new node to current head
    Atomics.store(this.sab, offset + NODE.PACKED_A, head)

    // Make new node the head
    Atomics.store(this.sab, HDR.FREE_LIST_HEAD_LOW, ptr)

    // Update counters
    Atomics.add(this.sab, HDR.FREE_COUNT, 1)
  }
}
```

### 3.4 Header Layout Changes

Remove the 64-bit tagged pointer, use a simple 32-bit head pointer:

| Offset | Current (MPMC) | New (SPSC) |
|--------|----------------|------------|
| 24-31 | `FREE_LIST_HEAD` (64-bit) | `FREE_LIST_HEAD_LOW` (32-bit) |
| 28-31 | (version in upper 32 bits) | Available for future use |

The `HDR_I64` constant and `BigInt64Array` dependency can be removed from FreeList.

### 3.5 Why ABA is Not a Concern

The ABA problem occurs when:
1. Thread A reads value X
2. Thread B changes X → Y → X
3. Thread A's CAS succeeds incorrectly (X == X)

In SPSC, there's only one thread. There is no Thread B. The sequence is:
1. Thread A reads X
2. Thread A changes X → Y (no interruption possible within JS event loop)
3. No CAS needed

**ABA requires concurrency. SPSC has none.**

### 3.6 Memory Barriers

We retain `Atomics.load()` and `Atomics.store()` (not plain reads/writes) for:
1. **Memory barrier semantics**: Ensures writes are visible to the AudioWorklet on architectures with relaxed memory models (ARM)
2. **Future-proofing**: If we ever need to read FreeList state from another thread for diagnostics

## 4. Migration Plan

### 4.1 Phase 1: Add Runtime Check (Non-Breaking)

Add the SPSC invariant check to existing implementation:

```typescript
// silicon-synapse.ts
allocNode(): NodePtr {
  if (process.env.NODE_ENV !== 'production' && !this.isAudioContext) {
    console.error('SPSC VIOLATION: allocNode() called outside AudioWorklet context')
  }
  return this.freeList.alloc()
}
```

### 4.2 Phase 2: Replace FreeList Implementation

1. Update `FreeList` class with SPSC implementation
2. Remove `BigInt64Array` dependency from FreeList
3. Update `FreeList.initialize()` to use 32-bit head
4. Keep `HDR_I64` for other potential 64-bit uses

### 4.3 Phase 3: Update Tests

1. Verify all existing tests pass
2. Add test that validates SPSC invariant check fires
3. Remove any tests that specifically test CAS retry behavior

## 5. Compatibility

### 5.1 Breaking Changes

- **Memory layout**: `FREE_LIST_HEAD` changes from 64-bit to 32-bit
- **SAB initialization**: Must be re-initialized (not backward compatible with existing SABs)
- **Saved sessions**: Any persisted SAB snapshots from previous versions will NOT work. Applications must create fresh SABs after this change. This is acceptable because SABs are runtime state, not persistent storage.

### 5.2 Non-Breaking

- All public APIs remain the same
- `allocNode()` / `freeNode()` behavior unchanged
- Ring Buffer command processing unchanged

## 6. Performance Impact

| Metric | MPMC (Current) | SPSC (Proposed) |
|--------|----------------|-----------------|
| Allocation per `alloc()` | 16-24 bytes (BigInt) | 0 bytes |
| Allocation per `free()` | 0 bytes (hoisted) | 0 bytes |
| CAS retries | Possible under contention | N/A (no contention) |
| Code complexity | High (64-bit CAS) | Low (load/store) |

## 7. Future Considerations

If parallel worker support is ever needed, **do not revert to MPMC**. Instead, implement per-worker heaps as specified in RFC-056. This provides better scaling without shared mutable state.

## 8. Alternatives Considered

### 8.1 Keep MPMC as "Insurance"

Rejected. The cost (allocation every `alloc()`) is paid on every note insert. The benefit (multi-threaded safety) is never used. This is a bad trade-off.

### 8.2 Lock-Based FreeList

Possible but unnecessary. SPSC doesn't need any synchronization primitive for correctness. Adding a lock would be overhead for no benefit.

### 8.3 Per-Allocation Version Counter

Some systems use a monotonic counter per allocation instead of per-head. This still requires BigInt for the counter. Rejected.

## 9. References

- RFC-044: Zone A/B Partitioning
- RFC-056: Per-Worker Heap Scaling (future architecture)
- [SPSC Queue Pattern](https://www.1024cores.net/home/lock-free-algorithms/queues/unbounded-spsc-queue)
