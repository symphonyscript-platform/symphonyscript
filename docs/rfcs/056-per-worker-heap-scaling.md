# RFC-056: Per-Worker Heap Scaling Architecture

**Status**: DRAFT (Future Architecture)  
**Priority**: LOW (Reference Document)  
**Author**: Architect  
**Created**: 2026-01-28  
**Depends On**: RFC-044 (Zone Partitioning), RFC-055 (SPSC FreeList)

## 1. Abstract

This RFC documents the **future scaling architecture** for SymphonyScript if parallel worker support is ever needed. Rather than reverting to MPMC (Multi-Producer Multi-Consumer) shared FreeList with contention, the recommended approach is **per-worker heap partitioning** — each worker owns its own Zone with its own SPSC FreeList.

**This RFC is a reference document, not an implementation proposal.** It exists to:
1. Document the architectural decision against shared mutable state
2. Provide a clear migration path if parallelism is needed
3. Prevent future engineers from re-introducing MPMC "because we need parallel workers"

## 2. Motivation

### 2.1 Why Not Shared MPMC?

When parallelism is needed, the intuitive approach is:

```
❌ WRONG: Multiple workers sharing one FreeList

Worker 1 ─┐
Worker 2 ─┼──→ Shared FreeList (Zone A) ← CONTENTION
Worker 3 ─┘
```

Problems:
- **Cache line contention**: Multiple cores fighting over the same memory
- **CAS retries**: Under load, workers spin waiting for each other
- **Complexity**: 64-bit CAS, ABA prevention, version counters
- **Allocation**: BigInt required for 64-bit atomics in JavaScript

### 2.2 The Per-Worker Alternative

```
✅ CORRECT: Each worker owns its Zone

Worker 1 ──→ Zone A1 (FreeList 1) ← No contention
Worker 2 ──→ Zone A2 (FreeList 2) ← No contention  
Worker 3 ──→ Zone A3 (FreeList 3) ← No contention
```

Benefits:
- **Zero contention**: Each worker has exclusive access
- **SPSC preserved**: Each FreeList remains single-threaded
- **Linear scaling**: Add workers, add zones
- **Simple code**: No CAS, no version counters

## 3. Architecture

### 3.1 Current Architecture (RFC-044)

```
┌──────────────────────────────────────────────────────┐
│                 SharedArrayBuffer                     │
├────────────────────────────┬─────────────────────────┤
│         Zone A             │        Zone B           │
│     (AudioWorklet)         │    (Main Thread)        │
│     SPSC FreeList          │    LocalAllocator       │
│     nodeCapacity/2 nodes   │    nodeCapacity/2 nodes │
└────────────────────────────┴─────────────────────────┘
```

### 3.2 Future Architecture (This RFC)

```
┌──────────────────────────────────────────────────────────────────┐
│                     SharedArrayBuffer                             │
├───────────┬───────────┬───────────┬───────────┬──────────────────┤
│  Zone A1  │  Zone A2  │  Zone A3  │  Zone A4  │     Zone B       │
│ Worker 1  │ Worker 2  │ Worker 3  │ Worker 4  │  Main Thread     │
│ FreeList1 │ FreeList2 │ FreeList3 │ FreeList4 │  LocalAllocator  │
│  SPSC     │  SPSC     │  SPSC     │  SPSC     │     SPSC         │
└───────────┴───────────┴───────────┴───────────┴──────────────────┘
```

Each Zone Ax is:
- Owned exclusively by one Worker
- Has its own FreeList (SPSC)
- Has its own node capacity
- Isolated from other Zones

### 3.3 SAB Header Extensions

New header fields for multi-zone support:

```typescript
const HDR_MULTIZONE = {
  // Zone configuration
  ZONE_COUNT: 30,           // Number of worker zones (1-8 typical)
  ZONE_CONFIG_OFFSET: 31,   // Offset to zone configuration table
  
  // Per-zone config (repeated for each zone)
  // Offset = ZONE_CONFIG_OFFSET + (zoneIndex * ZONE_CONFIG_STRIDE)
  ZONE_CONFIG_STRIDE: 8,    // 8 i32 slots per zone
}

// Per-zone configuration (8 slots = 32 bytes per zone)
const ZONE_CONFIG = {
  HEAP_START: 0,            // First node offset in this zone
  HEAP_END: 1,              // Last node offset + 1
  FREE_LIST_HEAD: 2,        // Current free list head (32-bit, SPSC)
  FREE_COUNT: 3,            // Free nodes in this zone
  NODE_COUNT: 4,            // Allocated nodes in this zone
  NODE_CAPACITY: 5,         // Total capacity of this zone
  OWNER_ID: 6,              // Worker ID that owns this zone
  RESERVED: 7,              // Future use
}
```

### 3.4 Zone Assignment

When a Worker starts, it claims a Zone:

```typescript
class SiliconSynapse {
  private zoneIndex: number
  private zoneConfig: ZoneConfig
  private freeList: FreeList

  /**
   * Factory method - use instead of constructor.
   * @returns SiliconSynapse on success, null if no zones available
   */
  static create(sab: SharedArrayBuffer, workerId: number): SiliconSynapse | null {
    const instance = new SiliconSynapse(sab)
    
    // Find or allocate a zone for this worker
    const zoneIndex = instance.claimZone(workerId)
    if (zoneIndex === -1) {
      // Zero-allocation: return null instead of throwing
      return null  // Caller must check for null
    }
    
    instance.zoneIndex = zoneIndex
    instance.zoneConfig = instance.loadZoneConfig(zoneIndex)
    
    // Create SPSC FreeList for our zone only
    instance.freeList = new FreeList(
      instance.sab,
      instance.zoneConfig.heapStart,
      instance.zoneConfig.heapEnd
    )
    
    return instance
  }

  private constructor(sab: SharedArrayBuffer) {
    this.sab = new Int32Array(sab)
    // Zone-specific fields initialized by factory
  }

  /**
   * Claim a zone for this worker.
   * @returns Zone index (0+) on success, -1 if no zones available
   */
  private claimZone(workerId: number): number {
    const zoneCount = this.sab[HDR_MULTIZONE.ZONE_COUNT]
    
    for (let i = 0; i < zoneCount; i++) {
      const ownerOffset = this.getZoneConfigOffset(i) + ZONE_CONFIG.OWNER_ID
      
      // Atomic claim: CAS from 0 (unclaimed) to workerId
      const result = Atomics.compareExchange(
        this.sab, ownerOffset, 0, workerId
      )
      
      if (result === 0) {
        return i  // Successfully claimed zone i
      }
    }
    
    // Zero-allocation: return error code instead of throwing
    return -1  // ZONE_ERR.NO_ZONES_AVAILABLE
  }
}
```

### 3.5 Cross-Zone Communication

**Command Dispatch Architecture:**

The Main Thread remains the command dispatcher. Each Worker has its own Ring Buffer:

```
                    ┌─────────────────────────────────────┐
                    │           Main Thread               │
                    │     (Command Router/Dispatcher)     │
                    └──────────────┬──────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Ring Buffer 1  │    │  Ring Buffer 2  │    │  Ring Buffer 3  │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Worker 1     │    │    Worker 2     │    │    Worker 3     │
│    (Zone A1)    │    │    (Zone A2)    │    │    (Zone A3)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Command Routing:**
- Main Thread determines which Worker should handle each command (e.g., by track ID)
- Writes command to that Worker's Ring Buffer
- Each Worker only processes its own Ring Buffer
- Workers do NOT communicate directly with each other

**Why not Worker-to-Worker communication:**
- Adds complexity (N² communication paths)
- Workers should be independent processing units
- If cross-worker coordination is needed, route through Main Thread

### 3.6 Cross-Zone Reclamation

**The Problem:** Worker X may need to free a node that was allocated by Worker Y.

Example scenario:
1. Worker 2 allocates Node X from Zone A2
2. Node X is linked into a shared global chain (or cross-worker reference)
3. Main Thread sends DELETE command for Node X to Worker 1
4. Worker 1 calls `freeNode(X)` — but X belongs to Zone A2!

**Solution: Return Queues (MPSC)**

Each Zone has an associated MPSC (Multi-Producer Single-Consumer) Return Queue:

```typescript
class ZoneFreeList {
  private myZone: number
  private localHead: number          // SPSC for local alloc/free
  private returnQueue: ReturnQueue   // MPSC for cross-zone frees

  /**
   * Free a node. Routes to correct zone automatically.
   */
  free(ptr: NodePtr): void {
    const zone = this.getZoneForPtr(ptr)

    if (zone === this.myZone) {
      // Same zone: SPSC local free (instant, zero contention)
      this.localFree(ptr)
    } else {
      // Cross-zone: Enqueue to target zone's return queue
      zones[zone].returnQueue.enqueue(ptr)
    }
  }

  /**
   * Drain return queue at start of each process cycle.
   * Called by the zone's owner Worker.
   */
  drainReturnQueue(): void {
    let ptr: NodePtr
    while ((ptr = this.returnQueue.dequeue()) !== NULL_PTR) {
      this.localFree(ptr)  // Now SPSC, we own this zone
    }
  }

  /**
   * Determine which zone a pointer belongs to.
   * O(1) using arithmetic (requires equal-sized zones).
   */
  private getZoneForPtr(ptr: NodePtr): number {
    // All zones have equal capacity, so we can compute zone index directly
    const offset = ptr - this.globalHeapStart
    
    // Division by zone size gives zone index
    // Using bit shift if zoneSize is power of 2, otherwise integer division
    const zoneIndex = (offset / this.zoneSizeBytes) | 0  // Fast integer division
    
    if (zoneIndex < 0 || zoneIndex >= this.zoneCount) {
      return -1  // Invalid pointer (out of heap range)
    }
    
    return zoneIndex
  }
}
```

**Return Queue Implementation:**

```typescript
/**
 * MPSC Return Queue for cross-zone frees.
 * Multiple workers can enqueue (producers), one worker drains (consumer).
 */
class ReturnQueue {
  private buffer: Int32Array  // Fixed-size ring buffer in SAB
  private head: number        // Atomic: producers CAS here
  private tail: number        // Only owner reads/advances

  /**
   * Enqueue a pointer (called by any worker).
   * Lock-free MPSC using CAS on head.
   * 
   * IMPORTANT: We write ptr BEFORE the CAS to avoid a race condition.
   * If CAS fails, our write is harmless (will be overwritten by winner).
   */
  enqueue(ptr: NodePtr): boolean {
    while (true) {
      const head = Atomics.load(this.sab, this.headOffset)
      const next = (head + 1) % this.capacity

      if (next === Atomics.load(this.sab, this.tailOffset)) {
        return false  // Queue full
      }

      // Write ptr BEFORE claiming the slot (avoids read-before-write race)
      Atomics.store(this.sab, this.bufferOffset + head, ptr)

      if (Atomics.compareExchange(this.sab, this.headOffset, head, next) === head) {
        return true  // Slot claimed, ptr already written
      }
      // CAS failed, another producer may have overwritten our ptr, retry
    }
  }

  /**
   * Dequeue a pointer (called only by zone owner).
   * SPSC on consumer side - no atomics needed for tail.
   */
  dequeue(): NodePtr {
    const tail = this.sab[this.tailOffset]
    const head = Atomics.load(this.sab, this.headOffset)

    if (tail === head) {
      return NULL_PTR  // Queue empty
    }

    const ptr = Atomics.load(this.sab, this.bufferOffset + tail)
    this.sab[this.tailOffset] = (tail + 1) % this.capacity

    return ptr
  }
}
```

**Integration with `poll()`:**

```typescript
// In SiliconSynapse.poll()
poll(): number {
  this.isAudioContext = true

  // Step 1: Drain cross-zone returns first
  this.freeList.drainReturnQueue()

  // Step 2: Process commands
  const result = this.processCommands()

  this.isAudioContext = false
  return result
}
```

### 3.7 Zone Imbalance Handling

**The Problem:** Zone A1 exhausts while Zone A2 has free nodes.

**Options:**

| Strategy | Complexity | Latency Impact | Recommendation |
|----------|------------|----------------|----------------|
| **Fail fast** | Low | None | ✅ For real-time |
| **Work stealing** | High | Variable | ❌ Unpredictable |
| **Pre-allocation hints** | Medium | None | ✅ For planning |

**Recommended: Fail Fast + Pre-Allocation Hints**

```typescript
allocNode(): NodePtr {
  const ptr = this.freeList.alloc()

  if (ptr === NULL_PTR) {
    // Zone exhausted - set error, don't steal from other zones
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.ZONE_EXHAUSTED)

    // Notify Main Thread to rebalance workload
    this.notifyZoneExhausted(this.zoneIndex)

    return NULL_PTR
  }

  return ptr
}
```

**Why not work stealing:**
- Introduces cross-zone contention (defeats the purpose)
- Unpredictable latency in real-time audio
- Complex implementation

**Main Thread Rebalancing:**
- Main Thread monitors zone fill levels
- Routes new commands to less-loaded zones
- Can migrate clips between workers during pause

**Zone Sizing Guidelines:**

> **IMPORTANT:** All zones MUST have equal capacity for O(1) `getZoneForPtr()` lookup.
> If different workloads need different capacities, use multiple zones per worker instead.

```typescript
// Equal-sized zones (required for O(1) pointer-to-zone lookup)
const ZONE_CAPACITY = 2048  // All zones same size

createLinkerSAB({
  nodeCapacity: ZONE_CAPACITY * 4,  // 4 worker zones
  workerZones: 4,                   // Each gets ZONE_CAPACITY nodes
})

// For unequal workloads, assign multiple zones to heavy workers:
// Worker 1 (drums): claims zones 0, 1 → 4096 nodes
// Worker 2 (bass):  claims zone 2    → 2048 nodes  
// Worker 3 (fx):    claims zone 3    → 2048 nodes
```

**Why equal-sized zones:**
- Enables O(1) `getZoneForPtr()` via arithmetic: `zone = (ptr - heapStart) / zoneSize`
- Avoids O(n) loop or binary search on every cross-zone free
- Heavy workers can claim multiple sequential zones if needed

## 4. Use Cases

### 4.1 Multi-Track Parallel Rendering

Each track processed by a separate Worker:

```
Track 1 ──→ Worker 1 (Zone A1) ──→ Audio Output 1
Track 2 ──→ Worker 2 (Zone A2) ──→ Audio Output 2
Track 3 ──→ Worker 3 (Zone A3) ──→ Audio Output 3
                    │
                    ▼
              Master Mixer
```

### 4.2 Parallel Offline Bounce

Multiple Workers render different time segments:

```
Segment 0-10s   ──→ Worker 1 (Zone A1)
Segment 10-20s  ──→ Worker 2 (Zone A2)
Segment 20-30s  ──→ Worker 3 (Zone A3)
                         │
                         ▼
                  Concatenate Output
```

### 4.3 Live + Preview

Separate Workers for live playback and preview:

```
Live Playback  ──→ Worker 1 (Zone A1) ──→ Main Output
Preview/Scrub  ──→ Worker 2 (Zone A2) ──→ Preview Output
```

## 5. Migration Path

### 5.1 From Current (Single Zone A) to Multi-Zone

1. **Extend SAB header** with zone configuration table
2. **Modify `createLinkerSAB()`** to accept zone count parameter
3. **Update `FreeList`** to accept zone bounds
4. **Update `SiliconSynapse`** to claim and use assigned zone
5. **Add zone negotiation** for Worker startup

### 5.2 Backward Compatibility

Default configuration (1 worker zone) should behave identically to current system:

```typescript
createLinkerSAB({ 
  nodeCapacity: 4096,
  workerZones: 1  // Default: single Zone A (current behavior)
})
```

## 6. Comparison: MPMC vs Per-Worker

| Aspect | MPMC (Rejected) | Per-Worker (Proposed) |
|--------|-----------------|----------------------|
| Contention | High under load | None |
| Scaling | Degrades with workers | Linear |
| Allocation | BigInt per alloc() | Zero |
| Complexity | 64-bit CAS, ABA prevention | Simple load/store |
| Memory overhead | None | Zone config table (~32 bytes/zone) |
| Code changes | Revert RFC-055 | New zone management |

## 7. When to Implement

**Do not implement this RFC until there is a concrete need** for one of:
- Multi-track parallel rendering
- Parallel offline bounce
- Multiple independent audio graphs

The current single-worker architecture handles:
- ✅ Complex compositions (thousands of nodes)
- ✅ Real-time playback with low latency
- ✅ Live coding with hot-reload

Only implement when the single worker becomes a bottleneck.

## 8. Anti-Patterns to Avoid

### 8.1 Shared FreeList with MPMC

❌ **Never do this:**
```typescript
// BAD: Multiple workers sharing one FreeList
const sharedFreeList = new FreeList(sab)  // MPMC
worker1.freeList = sharedFreeList
worker2.freeList = sharedFreeList
```

### 8.2 Cross-Zone Direct Allocation

❌ **Never do this:**
```typescript
// BAD: Worker 1 allocating from Worker 2's zone
const ptr = worker2Zone.freeList.alloc()  // SPSC violation!
```

### 8.3 Lock-Based Shared FreeList

❌ **Never do this:**
```typescript
// BAD: Using locks instead of partitioning
acquireMutex()
const ptr = sharedFreeList.alloc()
releaseMutex()
```

Locks cause priority inversion in audio contexts.

## 9. Summary

| Question | Answer |
|----------|--------|
| Will we need parallel workers? | Unlikely for current use cases |
| If we do, should we use shared MPMC? | **No** — use per-worker zones |
| Does per-worker preserve SPSC? | **Yes** — each zone is SPSC |
| Is this RFC for implementation now? | **No** — reference only |

## 10. References

- RFC-044: Zone A/B Partitioning (current architecture)
- RFC-055: SPSC FreeList (foundation for this RFC)
- [Partitioned Data Structures](https://en.wikipedia.org/wiki/Partition_(database))
- [Thread-Local Storage Pattern](https://en.wikipedia.org/wiki/Thread-local_storage)
