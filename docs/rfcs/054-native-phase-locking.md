# RFC-054: Native Phase Guardrails

**Status**: IMPLEMENTED (Revision 5)  
**Author**: Antigravity  
**Created**: 2025-12-30  
**Last Updated**: 2025-12-30

## 1. Abstract

This RFC proposes a native **Phase Barrier** mechanism in the SymphonyScript Kernel (`OPCODE.BARRIER`) to enforce topological phase alignment at the "Bare Metal" level. This replaces OS-level "Elastic Spacer" logic with a robust, runtime-evaluated CPU instruction. It also defines the "Implicit Loop" architecture in the Synaptic Layer, where defining a loop instantly reifies it as a closed topology with a Phase Barrier, removing the need for manual finalization.

## 2. Motivation

Previous attempts to implement phase locking relied on "Ghost State" (properties in `SynapticNode` that didn't exist in the graph) or "Elastic Spacers" (standard REST nodes resized at build time). These approaches had significant downsides:

1.  **Complexity**: The OS had to manually calculate duration gaps.
2.  **Fragility**: Generative or variable-length content could break the pre-calculated spacing.
3.  **UX Burden**: Users often had to call `.finalize()` to "seal" the loop.

We desire a system where:
*   Phase is a First-Class Kernel Primitive.
*   Looping is implicit and impossible to break.
*   Generative paths automatically quantize to the phase cycle.

## 3. Specification

### 3.1 Namespace Clarification

This RFC introduces additions to TWO distinct namespaces:

| Namespace | Purpose | Storage Location |
|-----------|---------|------------------|
| `OPCODE` | Node Type (What kind of musical event) | `NODE.PACKED_A` bits 24-31 |
| `CMD` | Ring Buffer Command (Deferred operation) | Ring Buffer slot 0 |

**New Definitions:**
- `OPCODE.BARRIER = 0x05` (Node Opcode for Phase Barrier)
- `CMD.CONNECT = 5` (Ring Buffer Command for Async Synapse Creation)
- `CMD.DISCONNECT = 6` (Ring Buffer Command for Async Synapse Removal)

### 3.2 Kernel Layer: `OPCODE.BARRIER`

We define a new Node Opcode `0x05` (BARRIER).

**Node Fields for BARRIER:**
| Field | Value | Semantics |
|-------|-------|-----------|
| `opcode` | `0x05` | Identifies as BARRIER |
| `pitch` | `0` | Unused |
| `velocity` | `0` | Unused |
| `duration` | `CYCLE_LENGTH` | The phase period in ticks |
| `baseTick` | `0` | Barrier is timeless (evaluated at runtime) |

**`baseTick = 0` Rationale:**
A BARRIER is not a musical event "at a specific time". It is a **synchronization point**. The Consumer evaluates it based on `PLAYHEAD_TICK` when it reaches the BARRIER, not based on `baseTick`. Setting `baseTick = 0` signals "evaluate me dynamically".

### 3.3 BARRIER Execution Semantics (State Machine Hold)

When the Playback Engine (Consumer) encounters a `BARRIER` node:

```
Algorithm: BARRIER_WAIT
Input: currentTick (HDR.PLAYHEAD_TICK), cycleLength (NODE.DURATION)

1. Calculate Remainder = currentTick % cycleLength
2. Calculate Wait = cycleLength - Remainder
3. IF Remainder == 0:
     Wait = 0            // Already aligned. No pause.
4. IF Wait > 0:
     Hold State:
       - Do NOT advance currentPtr to NEXT_PTR
       - Store targetTick = currentTick + Wait
     On subsequent process() calls:
       - IF playheadTick >= targetTick:
           Advance currentPtr = NEXT_PTR
5. ELSE:
     Advance currentPtr = NEXT_PTR immediately
```

**Key Points:**
- This is a **State Machine Hold**, not a literal `sleep()`.
- The Consumer retains its position and checks on each `process()` call.
- Zero-allocation: Only stack variables are used.

**BARRIER as First Node (Loop Entry):**
If the cursor starts at a BARRIER (e.g., entering a loop for the first time):
1.  On first `process()`, calculate `Wait` from the current `PLAYHEAD_TICK`.
2.  This aligns the loop to the global phase immediately.
3.  Valid behavior: "Wait for grid alignment before playing the first note."

### 3.4 OS Layer: Topology Management

The `SynapticNode` (OS) exposes Phase Barriers via `setCycle(ticks)`.

**Properties Added to `SynapticNode`:**
```typescript
protected barrierId: number | undefined;  // Pointer to BARRIER node
protected barrierPtr: number | undefined; // Raw pointer for async ops
protected writeId: number | undefined;    // Last content node (for splicing)
```

**Insertion Logic (Critical):**
To support `loop(16).note().note()` (Reverse Polish Notation style definition), the Synaptic Layer tracks two pointers:

1.  `writeId` (The last musical note added).
2.  `barrierId` (The immutable phase barrier at the end).

When `addNote` is called:
*   If `barrierId` exists: Insert NewNote **after** `writeId`. The existing `_insertNode` splicing logic automatically links `NewNote -> Barrier`.
*   Correct chaining: `writeId` → `NewNote` → `barrierId`.
*   Update `writeId` = `NewNote`.

**Splicing Verification:**
The existing `_insertNode` (silicon-synapse.ts lines 508-520) correctly implements doubly-linked list splicing:
- Line 509: Reads `noteBPtr` (current next of afterPtr)
- Line 510: Sets `newNode.NEXT_PTR = noteBPtr`
- Line 516: Updates `noteB.PREV_PTR = newNode`
- Line 520: Updates `afterPtr.NEXT_PTR = newNode`

No new `insertBefore` operation is needed.

**Idempotency & Updates:**
Calling `setCycle` multiple times must not stack barriers.
*   If `barrierId` exists: **Update** the `DURATION` using `bridge.patchDirect(barrierId, 'duration', newCycleLength)`.
*   If `barrierId` is null: **Insert** a new Barrier.

**Why `patchDirect` (not `CMD.PATCH`):**
`CMD.PATCH` is not implemented in the current kernel. `bridge.patchDirect(sourceId, type, value)` is synchronous and safe for attribute mutations on nodes we own. The `type` parameter is a string (`'pitch'`, `'velocity'`, `'duration'`, `'baseTick'`, `'muted'`). Since the Barrier was created by this same `SynapticNode`, direct patching is valid.

**Cycle Removal (`setCycle(0)`):**
Calling `setCycle(0)` or `setCycle(null)` signifies "Remove Phase Locking".
1.  Delete the BARRIER node: `bridge.deleteAsync(barrierPtr)` → Internally executes `ringBuffer.write(CMD.DELETE, barrierPtr, 0)`.
2.  Remove the loop synapse: `bridge.disconnectAsync(barrierPtr, entryPtr)` → Synapse direction is `BARRIER → Entry` (source → target).
3.  Reset state: `barrierId = undefined`, `barrierPtr = undefined`.
4.  Result: The topology becomes linear (open-ended).

**`deleteAsync` Definition:**
`deleteAsync(ptr)` is a convenience wrapper that queues `CMD.DELETE` to the Ring Buffer:
```typescript
deleteAsync(ptr: NodePtr): void {
  this.ringBuffer.write(CMD.DELETE, ptr, 0);
  Atomics.notify(this.sab, HDR.YIELD_SLOT, 1);
}
```

### 3.5 Async Safety & Kernel Command Extension

The connection race condition (ID not yet existing in Worker) is solved by extending the Kernel Protocol.

**Single-Threaded Main Thread Assumption:**
JavaScript's Main Thread is single-threaded (Event Loop). All calls to `insertAsync()` and `connectAsync()` within a synchronous execution block are guaranteed to be enqueued in order. The Ring Buffer preserves FIFO ordering.

#### `CMD.CONNECT` (Opcode 5)

**Format:** `[CMD.CONNECT, SourcePtr, TargetPtr, PackedWeightJitter]`

| Slot | Field | Type | Description |
|------|-------|------|-------------|
| 0 | Opcode | i32 | `5` (CMD.CONNECT) |
| 1 | SourcePtr | i32 | Byte offset to source node |
| 2 | TargetPtr | i32 | Byte offset to target node |
| 3 | PackedWJ | i32 | `(Weight << 16) | (Jitter & 0xFFFF)` |

**Defaults:** If PackedWJ is 0, use `weight = 500, jitter = 0`.

**Worker Execution (`executeConnect`):**
```typescript
private executeConnect(srcPtr: NodePtr, tgtPtr: NodePtr, packedWJ: number): boolean {
  // 1. Validate pointers are in valid heap range
  if (!this.isValidHeapPtr(srcPtr) || !this.isValidHeapPtr(tgtPtr)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR);
    return false;
  }
  
  // 2. Unpack weight and jitter
  const weight = (packedWJ >>> 16) || 500;  // Default 500 if 0
  const jitter = packedWJ & 0xFFFF;
  
  // 3. Create synapse (returns SynapsePtr or error code)
  const result = this.synapseAllocator.connect(srcPtr, tgtPtr, weight, jitter);
  return result >= 0;
}
```

**Note on ID Table:**
Internal synapses created via `CMD.CONNECT` use raw pointers and do **not** require ID Table updates. The ID Table maps `SourceID → NodePtr` for external lookups. Internal synapses bypass this because the Synaptic Layer already holds the pointer references directly.

#### `CMD.DISCONNECT` (Opcode 6)

**Format:** `[CMD.DISCONNECT, SourcePtr, TargetPtr, RESERVED]`

| Slot | Field | Type | Description |
|------|-------|------|-------------|
| 0 | Opcode | i32 | `6` (CMD.DISCONNECT) |
| 1 | SourcePtr | i32 | Byte offset to source node |
| 2 | TargetPtr | i32 | Byte offset to target node (or 0 for "all from source") |
| 3 | Reserved | i32 | `0` |

**Worker Execution (`executeDisconnect`):**
```typescript
private executeDisconnect(srcPtr: NodePtr, tgtPtr: NodePtr): boolean {
  // Validate source pointer
  if (!this.isValidHeapPtr(srcPtr)) {
    Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR);
    return false;
  }
  
  if (tgtPtr === NULL_PTR) {
    // Disconnect all synapses from source
    return this.synapseAllocator.disconnectAll(srcPtr);
  } else {
    // Disconnect specific synapse
    if (!this.isValidHeapPtr(tgtPtr)) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.INVALID_PTR);
      return false;
    }
    return this.synapseAllocator.disconnect(srcPtr, tgtPtr);
  }
}
```

### 3.6 Application Layer: Zero-Burden UX

The `SynapticClip` (App) removes `.finalize()`.

*   User calls `clip.loop(16)`.
*   System immediately appends the Barrier(16) and closes the loop.
*   The topology is valid instantly.

**API Surface:**
```typescript
// SynapticClip
loop(cycleLength: number): this {
  this.setCycle(cycleLength);
  return this;
}

// Inherited from SynapticNode
setCycle(ticks: number): void {
  if (ticks <= 0) {
    // Remove cycle
    if (this.barrierPtr !== undefined) {
      this.bridge.deleteAsync(this.barrierPtr);
      // Synapse direction: BARRIER → Entry (source → target)
      this.bridge.disconnectAsync(this.barrierPtr, this.entryPtr);
      this.barrierId = undefined;
      this.barrierPtr = undefined;
    }
    return;
  }
  
  if (this.barrierId !== undefined) {
    // Update existing barrier duration (type is string 'duration')
    this.bridge.patchDirect(this.barrierId, 'duration', ticks);
  } else {
    // Insert new barrier
    const sourceId = this.bridge.generateSourceId();
    const ptr = this.bridge.insertAsync(
      OPCODE.BARRIER, 0, 0, ticks, 0, false, sourceId, this.writeId
    );
    this.barrierId = sourceId;
    this.barrierPtr = ptr;
    
    // Connect barrier to entry (loop closure)
    // Synapse direction: BARRIER → Entry (source → target)
    if (this.entryPtr !== undefined) {
      this.bridge.connectAsync(ptr, this.entryPtr, 500, 0);
    }
  }
}
```

### 3.7 `connect(ID)` vs `connectAsync(Ptr)` Usage

| Method | Use Case | Thread Safety |
|--------|----------|---------------|
| `connect(sourceId, targetId)` | Cross-clip wiring (Application) | IDs must be registered in Worker first |
| `connectAsync(srcPtr, tgtPtr)` | Internal construction (OS) | Safe for newly allocated nodes |

`connect(ID)` remains for external wiring where IDs are stable.
`connectAsync(Ptr)` is for internal atomic construction within `SynapticNode`.

## 4. Implementation Plan

### 4.1 Kernel Layer (`@symphonyscript/kernel`)

1.  **Constants (`constants.ts`)**:
    - Add `OPCODE.BARRIER = 0x05`
    - Add `CMD.CONNECT = 5`
    - Add `CMD.DISCONNECT = 6`

2.  **SiliconBridge (`silicon-bridge.ts`)**:
    - Implement `connectAsync(srcPtr, tgtPtr, weight?, jitter?)`
    - Implement `disconnectAsync(srcPtr, tgtPtr?)`
    - Implement `deleteAsync(ptr)` (alias for existing delete path)

3.  **SiliconSynapse (`silicon-synapse.ts`)**:
    - Add `isValidHeapPtr(ptr)` validation helper
    - Add `case CMD.CONNECT:` in `processCommands()`
    - Add `case CMD.DISCONNECT:` in `processCommands()`
    - Implement `executeConnect()` with pointer validation
    - Implement `executeDisconnect()` with pointer validation

4.  **MockConsumer (`mock-consumer.ts`)**:
    - Add State Machine Hold logic for `OPCODE.BARRIER`
    - Track `pendingBarrierTargetTick` for wait completion check

### 4.2 Synaptic Layer (`@symphonyscript/synaptic`)

1.  **SynapticNode (`SynapticNode.ts`)**:
    - Add properties: `barrierId`, `barrierPtr`, `writeId`
    - Implement `setCycle(ticks)` with Insert/Update/Delete logic
    - Update `addNote`/content methods to track `writeId`
    - Remove `enforcePhase()` (obsolete)

2.  **SynapticClip (`SynapticClip.ts`)**:
    - Delete `finalize()` method
    - Update `loop()` to call `setCycle()`

### 4.3 Validation

*   Verify `MockConsumer` halts for correct duration on BARRIER
*   Verify `insertAsync` + `connectAsync` sequence creates valid loop atomically
*   Verify `setCycle(0)` properly removes barrier and synapse
*   Verify splicing works when notes are added after `loop()` is called

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| BARRIER allocation fails (`insertAsync` returns `NULL_PTR`) | `setCycle` throws or returns error; no partial state |
| `connectAsync` fails (table full) | Worker sets `ERROR.TABLE_FULL`; caller should check |
| `setCycle()` on empty clip (`entryId` undefined) | No-op; cannot create loop without content |
| `setCycle(0)` when no barrier exists | No-op |
| Invalid pointer to `executeConnect` | Worker sets `ERROR.INVALID_PTR`; operation skipped |

## 6. Alternatives Considered

*   **Elastic Spacers (REST)**: Viable, but requires build-time math and fails with generative paths.
*   **No Phase Locking**: Rejected. The "Music OS" requires tight timing.

## 7. Compatibility

This adds new Opcodes and Commands. Existing consumers (if any) will need updates:

*   **MockConsumer**: Must implement State Machine Hold for `OPCODE.BARRIER`.
*   **SiliconSynapse**: Must handle `CMD.CONNECT` and `CMD.DISCONNECT`.
*   **Production AudioWorklet** (external): Specification is defined here; implementation deferred.

Existing `connect(ID)` API remains unchanged for backward compatibility.
