# K-005 Implementation Plan: Zone B Reclamation

## Goal
Implement memory reclamation for Zone B (Main Thread) nodes in `SiliconBridge`. This prevents heap exhaustion during long editing sessions by reusing deleted nodes via a "Local Free List" and a "Reclaim Ring Buffer" (Worker -> Main).

## User Review Required
> [!IMPORTANT]
> **SAB Layout Change**: `HEAP_START_OFFSET` will move from **144** to **160** bytes to accommodate 4 new header fields for the Reclaim Ring. This creates a happy accident of aligning the Node Heap to **32-byte boundaries** (previously 16-byte misaligned), potentially improving cache performance.

## Proposed Changes

### 1. Kernel (Constants & Init)
#### [MODIFY] [constants.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/constants.ts)
- Add `RECLAIM` constant group (Indices 36-39 for Headers).
- Update `HEAP_START_OFFSET` to 160.
- Update `calculateSABSize` to include `RECLAIM` ring size (16KB = 4096 ints).
- Add `getReclaimRingOffset`.

#### [MODIFY] [init.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/init.ts)
- Implement `initializeReclaimRingHeader`.
- Call it in `createLinkerSAB` and `resetLinkerSAB`.

### 2. Kernel (Worker Side)
#### [MODIFY] [silicon-synapse.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/silicon-synapse.ts)
- Add `reclaimRingBuffer` view.
- Update `executeDelete(ptr)`:
  - If `ptr` belongs to Zone B (`ptr >= zoneBStart`), write `ptr` to Reclaim Ring.
  - Increment `RECLAIM_RB_TAIL`.

### 3. Bridge (Main Side)
#### [MODIFY] [local-allocator.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/local-allocator.ts)
- Add `private freeHead: number` (Head of local free list, initially NULL).
- Implement `free(ptr)`:
  - Validates ptr.
  - Links ptr to current `freeHead` (using `NEXT_PTR` slot in unused node memory).
  - Updates `freeHead` to ptr.
  - Increments `freeCount`.
- Update `alloc()`:
  - Check `freeHead` first.
  - If valid, pop from list (LIFO).
  - Else, use Bump Pointer.
  - **Zero-on-Alloc** logic applies to both paths.

#### [MODIFY] [silicon-bridge.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/silicon-bridge.ts)
- Add `reclaimRingBuffer` view.
- Implement `pollReclaim()`:
  - Read `RECLAIM_RB_HEAD` and `TAIL`.
  - Loop while `HEAD !== TAIL`:
    - Read ptr from ring.
    - Call `localAllocator.free(ptr)`.
    - Increment `HEAD`.
- Update `flushStructural()` to call `pollReclaim()`.

## Verification Plan

### Automated Tests
#### [NEW] [k-005-reclamation.test.ts](file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel/src/__tests__/k-005-reclamation.test.ts)
1. **Reuse Verification**:
   - `bridge.insertNote()` (Zone B alloc).
   - `linker.processCommands()` (Link).
   - `bridge.deleteNote()` (Zone B reclaim queued).
   - `linker.processCommands()` (Execute delete -> Push to Reclaim Ring).
   - `bridge.flush()` (Poll Reclaim Ring -> LocalAllocator free).
   - `bridge.insertNote()` -> **Assert** new ptr equals old ptr.
2. **Ring Buffer Wrap-around**:
   - Fill Reclaim Ring > capacity and verify handling (drop or wrap? Ring should wrap/overwrite? Or drop? RFC-044 implies blocking or dropping. Reclaim is optimization, dropping is safe but leaks. Ring usually blocks writer? Worker cannot block. Drop is safer for Worker perf, but leaks memory. We will implement **Drop if Full** or **Resize**? Drop if Full).
3. **Zone A Exclusion**:
   - Verify deleting Zone A node does **not** push to Reclaim Ring (Zone A uses internal CAS free list).
