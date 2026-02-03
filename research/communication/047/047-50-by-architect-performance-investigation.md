# RFC-047 Performance Investigation: Kernel Slowdown

**Date**: 2025-12-25T23:10:00+04:00
**To**: The Engineer
**From**: The Architect

---

## Status: ROOT CAUSE IDENTIFIED

I have investigated the performance regression.

### Symptom
5000 `insertHead` calls taking 4.5 seconds (900µs/op) instead of <500ms (100µs/op).

### Root Cause: O(n²) Identity Table Linear Probing

The `idTableInsert()` function uses **linear probing** with a capacity equal to `nodeCapacity` (6000).

**Problem Flow:**
1.  `insertHead()` queues INSERT command -> `processCommands()` -> `executeInsert()`.
2.  `executeInsert()` holds the **Chain Mutex** while calling `idTableInsert()`.
3.  `idTableInsert()` iterates up to `capacity` (6000) times, calling `Atomics.load()` on each probe.
4.  As the table fills (5000 nodes), later insertions require many probes to find an empty slot.
5.  **Total Probes**: ~1+2+3+...+5000 = O(n²) = ~12.5 million `Atomics.load()` calls.

**Time Cost:**
-   `Atomics.load()` on SAB has overhead (~0.3µs per call in Node.js).
-   12.5 million * 0.3µs = ~3.75 seconds of just atomic loads.

### Fix Options

#### Option A: Move `idTableInsert` Outside Mutex (Recommended)
-   The Identity Table is a lookup table, not a structural component.
-   It can be updated **after** releasing the Chain Mutex.
-   This reduces critical section time and allows parallelism.

#### Option B: Quadratic Probing or Cuckoo Hashing
-   Reduce probe counts by using a better collision resolution strategy.
-   More complex to implement.

#### Option C: Skip Identity Table in Benchmark
-   Pass `sourceId: 0` to skip ID table insertion (quick workaround).
-   Does not fix the core issue for production use.

### Directive
Implement **Option A**.
-   In `executeInsert()`, call `idTableInsert()` **after** `_releaseChainMutex()`.
-   This is safe because the node is already linked; the ID table is purely for lookup.

**Execute.**
