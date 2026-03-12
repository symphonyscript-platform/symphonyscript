## Kernel Remediation Plan — Pre-RFC Draft

**Goal:** Make `@symphonyscript/kernel` production-ready for perpetual long-lived sessions (days/weeks, not hours).

**Scope:** 6 tasks across 4 files + test updates. No architectural changes — these are surgical fixes to existing code.

---

### Task 071: Reclaim Ring Modular Arithmetic

**Severity:** Critical
**Files:** `silicon-synapse.ts`, `silicon-bridge.ts`, `init.ts`
**Tests:** `k-005-reclamation.test.ts`

**Problem:** The reclaim ring (Zone B node recycling) uses monotonic head/tail counters stored in `Int32Array`. After ~2^31 operations, signed overflow causes `tail - head` to go negative, making the fullness check fail. The ring silently overwrites unconsumed entries or reports overflow falsely.

Both sides are affected:

- **Producer** (`_deleteNode` in `silicon-synapse.ts`, lines 836-853): `tail - head >= capacity` breaks on signed wrap; `tail + 1` overflows.
- **Consumer** (`pollReclaim` in `silicon-bridge.ts`, lines 933-954): `currentHead !== tail` and `currentHead++` break on signed wrap.

**Fix:** Switch from monotonic-counter style to wrapping-index style, matching the existing `RingBuffer` class:

- Head and tail stay in `[0, capacity)` — never overflow.
- Full check: `(tail + 1) % capacity === head`
- Empty check: `head === tail`
- Advance: `(index + 1) % capacity`

Producer (in `_deleteNode`):
```typescript
const tail = Atomics.load(this.sab, HDR.RECLAIM_RB_TAIL)
const capacity = Atomics.load(this.sab, HDR.RECLAIM_RB_CAPACITY)
const head = Atomics.load(this.sab, HDR.RECLAIM_RB_HEAD)
const nextTail = (tail + 1) % capacity

if (nextTail === head) {
  Atomics.or(this.sab, HDR.ERROR_FLAG, ERROR.RECLAIM_OVERFLOW)
} else {
  const ringDataOffset = Atomics.load(this.sab, HDR.RECLAIM_RING_PTR)
  const ringDataI32 = ringDataOffset / 4
  Atomics.store(this.sab, ringDataI32 + tail, ptr)
  Atomics.store(this.sab, HDR.RECLAIM_RB_TAIL, nextTail)
}
```

Consumer (in `pollReclaim`):
```typescript
let currentHead = head
while (currentHead !== tail) {
  const ptr = this.sab[ringDataI32 + currentHead]
  this.localAllocator.free(ptr)
  currentHead = (currentHead + 1) % capacity
}
Atomics.store(this.sab, HDR.RECLAIM_RB_HEAD, currentHead)
```

**Test impact:** The k-005 test sets `head=7, tail=9` (monotonic style). These must be updated to use values in `[0, capacity)`.

**Constraint:** The `init.ts` initialization already sets head=0, tail=0 — no change needed there.

---

### Task 072: `patchMultiple` Offset Bounds Checking

**Severity:** Moderate
**Files:** `patch.ts`
**Tests:** New test cases in `silicon-linker.test.ts`

**Problem:** `patchMultiple` accepts caller-provided field offsets (`o1`-`o4`) that are used directly in `Atomics.store(sab, offset + oN, vN)`. No validation ensures offsets are within `[0, NODE_SIZE_I32)`. A buggy caller can corrupt arbitrary SAB memory — Identity Table, Synapse Table, Ring Buffer headers — silently.

**Fix:** Add bounds validation before any writes. Since `NODE_SIZE_I32 = 8`, offsets must be in `[0, 7]`:

```typescript
patchMultiple(ptr, o1, v1, o2, v2, o3, v3, o4, v4, count): boolean {
  if (!this.validatePtr(ptr)) return false
  const offset = this.nodeOffset(ptr)

  if (count >= 1 && (o1 < 0 || o1 >= NODE_SIZE_I32)) return false
  if (count >= 2 && (o2 < 0 || o2 >= NODE_SIZE_I32)) return false
  if (count >= 3 && (o3 < 0 || o3 >= NODE_SIZE_I32)) return false
  if (count >= 4 && (o4 < 0 || o4 >= NODE_SIZE_I32)) return false

  this.bumpSeq(offset)
  // ... stores ...
}
```

**Constraint:** Also validate `count` itself is in `[1, 4]`. Return `false` for `count <= 0` or `count > 4`.

---

### Task 073: Two-Phase SeqLock Protocol

**Severity:** Moderate (design correctness)
**Files:** `patch.ts` (writer), `silicon-synapse.ts` (reader)
**Tests:** `seq-wraparound.test.ts`, new torn-read detection tests

**Problem:** The current protocol bumps SEQ once *before* writing data. This creates a window where the reader sees the new seq, reads not-yet-written data, sees the same seq again, and accepts a stale-but-apparently-consistent snapshot.

While this is benign in the current SPSC context (the reader just sees old data for one extra cycle), it's incorrect by SeqLock semantics and would silently produce torn reads if multi-writer patching were ever introduced.

**Fix:** Implement standard even/odd two-phase SeqLock.

**Writer protocol** (in `patch.ts`):

Replace single `bumpSeq` with two methods:

```typescript
// Phase 1: Mark "write in progress" — seq becomes odd
private bumpSeqStart(offset: number): void {
  // CAS loop: increment seq by 1 (even → odd), preserve FLAGS_EXT
}

// Phase 2: Mark "write complete" — seq becomes even
private bumpSeqEnd(offset: number): void {
  // CAS loop: increment seq by 1 (odd → even), preserve FLAGS_EXT
}
```

Each patch method becomes:
```typescript
patchPitch(ptr, pitch) {
  if (!this.validatePtr(ptr)) return false
  const offset = this.nodeOffset(ptr)
  this.bumpSeqStart(offset)   // seq → odd (writing)
  this.casUpdatePackedA(offset, PACKED.PITCH_MASK, PACKED.PITCH_SHIFT, pitch)
  this.bumpSeqEnd(offset)     // seq → even (stable)
  return true
}
```

**Reader protocol** (in `readNodeRaw`):

Add odd-seq check before reading data:
```typescript
while (retries < MAX_SPINS) {
  const seq1 = (Atomics.load(this.sab, offset + NODE.SEQ_FLAGS) & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT

  if ((seq1 & 1) === 1) {
    retries = retries + 1
    continue  // Write in progress — spin
  }

  // ... read all 8 fields ...

  const seq2 = (buf[6] & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT
  if (!seqChanged(seq1, seq2)) {
    return true
  }
  retries = retries + 1
}
```

**Invariant:** Seq starts at 0 (even). Every patch does two bumps (0→1→2, 2→3→4, ...). Stable state is always even. Odd means write-in-progress.

**Performance impact:** Two CAS operations per patch instead of one. Each CAS is ~10ns uncontended, so patches go from ~10ns to ~20ns. Still well under the 0.001ms budget.

**Constraint:** `FreeList.free()` also bumps SEQ (via `Atomics.add`). It must bump by 2 (not 1) to maintain the even-stable invariant, or use `bumpSeqStart`/`bumpSeqEnd` pair. Since `free()` is SPSC and doesn't have a "writing" phase visible to readers (the node is already unlinked), bumping by 2 is simpler and preserves the invariant.

---

### Task 074: Atomic Writes in `writeNodeData`

**Severity:** Low (correctness hardening)
**Files:** `silicon-synapse.ts`
**Tests:** Existing tests pass unchanged

**Problem:** `writeNodeData` (line 745) uses direct `Int32Array` assignment instead of `Atomics.store`. While the production path writes via `LocalAllocator` and the node isn't visible to other threads yet, the non-atomic writes rely on the implicit release barrier of the subsequent atomic link operation. This is correct per the JS memory model but fragile — if the method is ever called outside the current pattern, writes could be reordered on ARM.

**Fix:** Replace all direct writes with `Atomics.store`:

```typescript
private writeNodeData(offset, opcode, pitch, velocity, duration, baseTick, sourceId, flags): void {
  const activeFlags = flags | FLAG.ACTIVE
  const packed = (opcode << PACKED.OPCODE_SHIFT) |
    ((pitch & 0xff) << PACKED.PITCH_SHIFT) |
    ((velocity & 0xff) << PACKED.VELOCITY_SHIFT) |
    (activeFlags & PACKED.FLAGS_MASK)

  Atomics.store(this.sab, offset + NODE.PACKED_A, packed)
  Atomics.store(this.sab, offset + NODE.BASE_TICK, baseTick | 0)
  Atomics.store(this.sab, offset + NODE.DURATION, duration | 0)
  Atomics.store(this.sab, offset + NODE.SOURCE_ID, sourceId | 0)
}
```

**Performance impact:** Negligible. `Atomics.store` on uncontended memory is ~2ns vs ~1ns for direct write.

---

### Task 075: Telemetry Counter Correctness

**Severity:** Low-Moderate
**Files:** `silicon-synapse.ts`
**Tests:** New telemetry test in `silicon-linker.test.ts`

**Problem:** The comment on `_incrementTelemetry` (line 392) claims a write-side race condition exists. **This is incorrect.** `Atomics.add` is atomic — exactly one thread receives the wrapping return value (-1), so exactly one thread detects the carry and increments HIGH. The write side is race-free.

However, there IS a read-side tearing issue: between the LOW wrap and the HIGH increment (~2ns window), a concurrent reader observing both fields independently would see LOW=0 with stale HIGH, making the 64-bit counter appear to jump backward by 2^32.

**Fix (two parts):**

1. **Correct the comment** on `_incrementTelemetry`. Remove the false race claim. Document that the write is race-free due to `Atomics.add` atomicity, and note the intentional ~2ns read-side tearing window (zero-alloc hot-path priority).

2. **Add `readTelemetry()` method** for consistent 64-bit reads. The `sab64` field (`BigInt64Array`) already exists. `TELEMETRY_OPS_LOW` is at i32 index 28, so the 64-bit value is at `BigInt64Array` index 14. A single `Atomics.load` on `BigInt64Array` returns an atomic, tear-free 64-bit value:

```typescript
readTelemetry(): bigint {
  return Atomics.load(this.sab64, HDR.TELEMETRY_OPS_LOW / 2)
}
```

This allocates one `BigInt` per call, but `readTelemetry` is a cold-path diagnostic method (not called from audio thread), so GC pressure is irrelevant.

---

### Task 076: Architectural Safety Documentation

**Severity:** Low (prevents future confusion)
**Files:** `silicon-synapse.ts`, `free-list.ts`
**Tests:** None

**Problem:** Several design decisions look like bugs to a reviewer unfamiliar with the architecture. These need explicit JSDoc explaining the safety reasoning.

**Items to document:**

1. **`executeClear` — no external race.** Add JSDoc explaining that `executeClear` only runs inside `processCommands()`, which runs inside `poll()`, which IS the audio thread. The main thread enqueues `CMD.CLEAR`; the audio thread executes it against its own chain. No external thread can observe a partially-cleared chain during execution.

2. **`_deleteNode` reclaim ring — single producer guaranteed.** Add JSDoc noting that the reclaim ring write is inside the Chain Mutex, which guarantees only one thread writes at a time. The non-CAS `tail` update is safe because the mutex serializes all producers.

3. **`FreeList.alloc()`/`free()` — SPSC by design, no CAS needed.** The JSDoc exists but should explicitly state: *"The SPSC invariant is enforced at runtime by `allocNode()`/`freeNode()` in `SiliconSynapse`, which check `isAudioContext` and set `ERROR.SPSC_VIOLATION` if violated. This eliminates the need for CAS — simple load/store is sufficient because only one thread touches these fields."*

4. **`readNodeRaw` — fallback NEXT_PTR safety.** Document why `buf[NODE.NEXT_PTR]` remains usable even when the SeqLock fails: freed nodes have NEXT_PTR zeroed by `zeroNode()`, so a failed SeqLock read terminates chain traversal safely rather than following a dangling pointer.

---

## Execution Order & Dependencies

```
Task 073 (SeqLock) ← no deps, but affects reader + writer across 2 files
Task 071 (Reclaim Ring) ← no deps, self-contained producer + consumer
Task 072 (patchMultiple) ← no deps, single file
Task 074 (writeNodeData) ← no deps, single file
Task 075 (Telemetry) ← no deps, single file
Task 076 (Documentation) ← should run LAST (references final code state)
```

Tasks 071-075 are independent and can be parallelized. Task 076 must go last since it documents the final state of the code.

## Files Changed Summary

| File | Tasks |
|------|-------|
| `silicon-synapse.ts` | 071, 073, 074, 075, 076 |
| `silicon-bridge.ts` | 071 |
| `patch.ts` | 072, 073 |
| `free-list.ts` | 073 (seq bump by 2), 076 |
| `k-005-reclamation.test.ts` | 071 |
| `silicon-linker.test.ts` | 072, 075 |
| `seq-wraparound.test.ts` | 073 |

---
