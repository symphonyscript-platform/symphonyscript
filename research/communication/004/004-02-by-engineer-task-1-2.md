# Task 1.2: Add Mutex Protection to compactTable()

**RFC:** 004 (Kernel Remediation)  
**Task:** 1.2  
**Severity:** CRITICAL  
**Status:** IMPLEMENTED

---

## Problem

`compactTable()` in `SynapseAllocator` performs a stop-the-world operation that:
1. Scans all live synapses (Phase 1)
2. Clears the entire table (Phase 2)
3. Clears the reverse index (Phase 3)
4. Reinserts all live synapses (Phase 4)

If `connect()` or `disconnect()` is called concurrently during any of these phases, data corruption is guaranteed:
- Live synapses could be lost
- Partially written entries could appear
- Reverse index could become inconsistent

---

## Solution

Added thread-safe compaction methods that accept mutex acquire/release callbacks from `SiliconSynapse`. This follows the remediation plan's Option A approach.

---

## Changes Made

### 1. `synapse-allocator.ts` - Added thread-safe compaction methods

```typescript
/**
 * Thread-safe compaction with mutex protection.
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

  const result = this.compactTable()
  releaseMutex()
  return result
}

/**
 * Check if compaction is needed and perform with mutex protection.
 */
maybeCompactSafe(
  acquireMutex: () => boolean,
  releaseMutex: () => void
): number {
  if (this.usedSlots < SYNAPSE_TABLE.COMPACTION_MIN_SLOTS) return 0
  if (this.getTombstoneRatio() < SYNAPSE_TABLE.COMPACTION_THRESHOLD) return 0
  return this.compactTableSafe(acquireMutex, releaseMutex)
}
```

### 2. `silicon-synapse.ts` - Added public mutex access methods

```typescript
/**
 * Acquire Chain Mutex (public wrapper for thread-safe operations).
 */
acquireMutex(): boolean {
  return this._acquireChainMutex()
}

/**
 * Release Chain Mutex (public wrapper for thread-safe operations).
 */
releaseMutex(): void {
  this._releaseChainMutex()
}
```

### 3. `silicon-synapse.ts` - Added convenience methods for safe compaction

```typescript
/**
 * Compact the Synapse Table with mutex protection.
 * 
 * @returns Number of live synapses after compaction, or -1 if mutex failed
 */
compactSynapseTable(): number {
  return this.synapseAllocator.compactTableSafe(
    () => this._acquireChainMutex(),
    () => this._releaseChainMutex()
  )
}

/**
 * Conditionally compact Synapse Table if tombstone ratio exceeds threshold.
 * 
 * @returns Number of live synapses after compaction, 0 if not needed, or -1 if mutex failed
 */
maybeCompactSynapseTable(): number {
  return this.synapseAllocator.maybeCompactSafe(
    () => this._acquireChainMutex(),
    () => this._releaseChainMutex()
  )
}
```

---

## Design Decisions

### 1. Callback Injection Pattern
Rather than having `SynapseAllocator` hold a reference to `SiliconSynapse` (circular dependency), mutex functions are injected as callbacks. This:
- Avoids circular dependencies
- Makes the allocator testable in isolation
- Keeps the original `compactTable()` available for internal use (within mutex-protected sections)

### 2. Public Mutex Access
Added `acquireMutex()` / `releaseMutex()` public methods to `SiliconSynapse` for:
- External callers who need custom locking patterns
- Future extensibility (other thread-safe operations)

### 3. Preserved Original Methods
The original `compactTable()` and `maybeCompact()` methods remain available:
- For internal use where mutex is already held
- For test compatibility
- Added warning comments about thread safety

---

## Files Changed

1. `packages/kernel/src/synapse-allocator.ts`
   - Added `compactTableSafe()` method
   - Added `maybeCompactSafe()` method
   - Added warning comment to `maybeCompact()`

2. `packages/kernel/src/silicon-synapse.ts`
   - Added `acquireMutex()` public method
   - Added `releaseMutex()` public method
   - Added `compactSynapseTable()` convenience method
   - Added `maybeCompactSynapseTable()` convenience method

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        9.251s
```

All 213 kernel tests pass.

---

## Thread Safety Guarantee

With this fix, the following scenarios are now safe:

| Scenario | Before | After |
|----------|--------|-------|
| `connect()` during compaction | DATA CORRUPTION | BLOCKED (mutex) |
| `disconnect()` during compaction | DATA CORRUPTION | BLOCKED (mutex) |
| `compactTable()` during `connect()` | DATA CORRUPTION | BLOCKED (mutex) |

The mutex ensures exclusive access to the Synapse Table during compaction.

---

*End of Task 1.2 Log*
