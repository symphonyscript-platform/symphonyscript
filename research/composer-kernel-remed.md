# Composer & Kernel Remediation: Direct-to-Silicon Architecture

## Executive Summary
This document outlines the remediation strategy for both the SymphonyScript **Kernel** (internal architecture) and **Composer** layer, aligning them with Zero-Allocation and "Direct-to-Silicon" principles. The goal is to eliminate all intermediate memory allocations during production/playback, guarantee data integrity under high load, and prepare the codebase for the Rust port.

## 1. Architectural Principles

### 1.1 Direct-to-Silicon
-   **No Buffering**: The Composer layer (`SynapticClip`) will **NOT** buffer operations or maintain a history array (`this.operations`).
-   **Immediate Flush**: All musical events (Notes, CCs) are flushed immediately to the Kernel's `SharedArrayBuffer` via `SiliconBridge`.
-   **Kernel as Truth**: The Kernel state is the single source of truth. The Composer layer acts purely as a stateless (or minimal state) fluent API for mutation.

### 1.2 Zero-Allocation Policy
-   **Primitive State**: `SynapticClip` and its cursors must store all state (Current Time, Transpose, Velocity, etc.) using **primitive values** (numbers, enums).
-   **No Objects**: No objects, arrays, or closures may be created in hot paths (e.g., inside loops, `note()`, `commit()`).
-   **Singleton Cursors**: Cursors (e.g., `SynapticMelodyNoteCursor`) are allocated **once** per Clip and reused. `clip.note()` merely resets the state of the existing cursor instance.

### 1.3 Bit-Packed Return Values
Methods that return compound data **must not** return objects. Instead:
-   **Hot-path methods**: Return a single `number` containing bit-packed fields. Provide companion `unpack*` functions at module scope.
-   **Cold-path methods** (>53-bit data): Accept a pre-allocated `Int32Array` out-parameter. Consumer allocates once, reuses forever.
-   **Never return objects** from Kernel or Bridge public API. Period.

**Packing budget**: JS numbers are IEEE 754 doubles with 53 bits of safe integer precision. Most kernel values have bounded ranges that pack efficiently:

| Value Type | Range | Bits |
|-----------|-------|------|
| Node/synapse count | 0–65,536 | 16 |
| Ratio as PPT (parts per thousand) | 0–1,000 | 10 |
| MIDI pitch/velocity | 0–127 | 7 |
| Zone index | 0–7 | 3 |
| Error code | 0–9 | 4 |

Two or three of these fit comfortably in a single return value.

### 1.4 Buffer-Based Node Reads
The callback-based `readNode(ptr, cb)` and `traverse(cb)` APIs (10-parameter callbacks) are replaced by a **consumer-allocated buffer** pattern:

-   **`readNodeRaw(ptr, buf: Int32Array): boolean`** — SeqLock-protected read into a caller-owned `Int32Array(8)`. No function dispatch, no argument passing, no unpacking inside the kernel.
-   **Consumer drives traversal** via `while` loop over `buf[NODE.NEXT_PTR]`.
-   **Contract**: Returns `true` → all 8 fields are a consistent snapshot. Returns `false` → only `buf[NODE.NEXT_PTR]` is usable (individually atomic) for chain continuation.
-   **Consumer unpacks only the fields they need** using helper functions (`unpackPitch(packed)`, etc.).
-   **~30-40% faster per node** vs. callback: no 10-arg stack push, no indirect function call, selective unpacking.

## 2. Kernel Layer Remediation

### 2.1 Ring Buffer Expansion
-   **Capacity**: Increase Command Ring Buffer capacity from `1,024` to **65,536** entries (~1MB). ✅ Done.
-   **Impact**: Allows bursting ~65k synchronous operations (notes/edits) before filling the buffer.

### 2.2 SiliconBridge Backpressure
-   **Mechanism**: **Spin-Wait**.
-   **Behavior**: When `SiliconBridge.writeOrSpin` encounters a full Ring Buffer:
    1.  It enters a tight loop (Spin-Wait).
    2.  It repeatedly checks `Atomics.load` on the Ring Buffer header.
    3.  It halts the Main Thread until the Audio Thread consumes commands and frees space.
-   **Safety**: On timeout, **return an error code** and set `HDR.ERROR_FLAG = ERROR.KERNEL_PANIC` in the SAB. **Do not throw a JavaScript exception.** Callers check the return value and act accordingly.
-   **Justification**: Throwing exceptions forces try/catch in callers, which defeats zero-allocation discipline and is impossible to express in Rust. Error codes are universal.

### 2.3 SEQ Counter Wraparound (patch.ts)

**Problem**: `SEQ_FLAGS` uses bits 8–31 for a monotonic sequence counter (max ~16.7M). `patchAttribute` increments with `(old & 0xFF) | ((((old >>> 8) + 1) & 0xFFFFFF) << 8)` and the counter will silently wrap to zero, causing stale-read false-positives in SeqLock consumers.

**Fix**: Add a **modular distance check** to SeqLock readers. After reading `seq_before` and `seq_after`:
```typescript
const HALF = 0x800000; // 2^23 / 2
function seqValid(before: number, after: number): boolean {
  return before === after && ((after - before) & 0xFFFFFF) < HALF;
}
```
This makes the counter work correctly across the wraparound boundary, identical to TCP sequence number arithmetic. Zero code changes to writers.

**Location**: `silicon-synapse.ts` → `readNode()` / any SeqLock read site, `patch.ts` → document the wraparound tolerance.

### 2.4 SynapseAllocator Singleton Ownership

**Problem**: Both `SiliconSynapse` and `SiliconBridge` instantiate their own `SynapseAllocator`. Since `usedSlots` and `tombstoneCount` are local instance fields, the two instances diverge silently. Any synapse allocated via Bridge is invisible to Synapse's allocator and vice versa.

**Fix**: **Single owner.** `SiliconBridge` is the sole owner and instantiator of `SynapseAllocator`. `SiliconSynapse` never creates one. Bridge exposes synapse operations through its own API; consumers go through Bridge.

**Location**: `silicon-bridge.ts` (already creates one — keep), `silicon-synapse.ts` (delete the second instantiation).

### 2.5 patchMultiple Zero-Allocation Fix

**Problem**: `patchMultiple(ptr, patches: Record<number, number>)` accepts an object literal. Every call site allocates `{ [OFFSET]: value, ... }` on the heap.

**Fix**: Replace with **positional parameters**:
```typescript
patchMultiple(
  ptr: NodePtr,
  offset1: number, value1: number,
  offset2: number, value2: number,
  offset3: number, value3: number,
  offset4: number, value4: number,
  count: number
): void
```
`count` specifies how many offset/value pairs are active (1–4). Unused pairs are ignored. No object, no iteration, no `Object.entries()`.

**Location**: `silicon-synapse.ts` → `patchMultiple`, all call sites.

### 2.6 readNode / traverse Replacement

**Problem**: `readNode(ptr, cb)` unpacks all 10 fields and invokes a callback with 10 positional arguments. `traverse(head, cb)` does the same in a loop. This pattern forces:
- Function dispatch overhead per node (indirect call)
- 10 arguments pushed to the call stack
- Consumer receives all fields even if it only needs 2

**Fix**: Delete both methods. Replace with `readNodeRaw(ptr, buf: Int32Array): boolean` per §1.4. Consumers drive their own traversal with `while (ptr !== NIL)` loops.

**Location**: `silicon-synapse.ts` → delete `readNode`, `traverse`. Add `readNodeRaw`. Update all consumers in `silicon-bridge.ts` and tests.

### 2.7 getZoneBStats Bit-Packed Return

**Problem**: `getZoneBStats()` returns `{ allocated, capacity, utilization }` — an object allocation on every call.

**Fix**: Return a single bit-packed `number`:
```
bits 0–15:  allocated (uint16, max 65,535)
bits 16–31: capacity  (uint16, max 65,535)
bits 32–41: utilization as PPT — parts per thousand (uint10, 0–1000)
```
Provide companion unpacking functions:
```typescript
function unpackZoneBAllocated(packed: number): number { return packed & 0xFFFF; }
function unpackZoneBCapacity(packed: number): number { return (packed >>> 16) & 0xFFFF; }
function unpackZoneBUtilization(packed: number): number { return (packed / 0x100000000) & 0x3FF; }
```
42 bits total — fits safely within the 53-bit integer budget.

**Location**: `local-allocator.ts` → `getUtilization()`, `silicon-bridge.ts` → `getZoneBStats()`.

### 2.8 writeOrSpin Error Handling

**Problem**: `writeOrSpin` in `SiliconBridge` throws `new Error('KERNEL_PANIC: ...')` on timeout. This is:
- An allocation (`new Error` + stack trace capture)
- Impossible in Rust AudioWorklet
- Forces callers to use try/catch

**Fix**: Return an error code (e.g., `ERROR.KERNEL_PANIC`). Set `Atomics.store(sab, HDR.ERROR_FLAG, ERROR.KERNEL_PANIC)` in the SAB header so the AudioWorklet can also observe the panic state. Callers check the return value.

**Location**: `silicon-bridge.ts` → `writeOrSpin`.

### 2.9 process.env.NODE_ENV Elimination

**Problem**: `FreeList.allocNode()` uses `process.env.NODE_ENV !== 'production'` for debug warnings. This is:
- A Node.js-ism that doesn't exist in AudioWorklet scope
- A string comparison on every allocation (hot path)
- Non-portable to Rust

**Fix**: Replace with a compile-time constant or a single numeric flag read from the SAB header (e.g., `HDR.DEBUG_FLAGS`). Vite's `define` can dead-code-eliminate debug branches in production builds.

**Location**: `free-list.ts`, `silicon-synapse.ts` — all `process.env` references.

### 2.10 Hash Table Probing: Quadratic

**Problem**: Identity Table uses linear probing, Synapse Table uses quadratic probing. Two probing strategies means two code paths, two sets of assumptions about load factor behavior, two things to get wrong.

**Fix**: Standardize on **quadratic probing** everywhere. Quadratic probing was introduced for the Synapse Table for good reason (clustering resistance). Apply it to Identity Table and Symbol Table as well. Fewer code paths, one set of load-factor assumptions.

**Location**: `silicon-synapse.ts` → `_identityLookup`, `_symbolLookup`.

### 2.11 SiliconBridge Decomposition

**Problem**: `SiliconBridge` is a 1,400+ line god class that owns: `SiliconSynapse`, `LocalAllocator`, `RingBuffer`, `SynapseAllocator`, `ReturnQueue`, debounce logic, commit protocol, patch orchestration, stats aggregation, and editor integration.

**Fix**: **Flag for decomposition** in a future task. This is not urgent but should be planned. Candidate splits:
- **BridgeMemory**: Owns `LocalAllocator`, `RingBuffer`, `ReturnQueue`
- **BridgeSynapse**: Owns `SynapseAllocator`, synapse CRUD
- **BridgeCommit**: Commit protocol, debounce, patch orchestration
- **SiliconBridge**: Thin facade delegating to the above

**Location**: `silicon-bridge.ts` — future task, not immediate.

### 2.12 validateLinkerSAB Multi-Zone Fix

**Problem**: `validateLinkerSAB` calculates expected SAB size using hardcoded default `synapseCapacity` and assumes 1 worker zone. Any SAB created with non-default parameters or multiple zones will fail validation despite being perfectly valid.

**Fix**: Read `synapseCapacity` and zone count from the SAB header itself (they are stored at `HDR.SYNAPSE_CAPACITY` and `HDR.ZONE_COUNT`) instead of using defaults.

**Location**: `init.ts` → `validateLinkerSAB`.

### 2.13 getSAB Dead Code

**Problem**: `SiliconBridge.getSAB()` has a JSDoc block but no function body. Dead code.

**Fix**: Delete the JSDoc and any empty stub.

**Location**: `silicon-bridge.ts`.

### 2.14 Rust Port Readiness Flags

**Problem**: Several TypeScript idioms will silently break or become expensive in a Rust port:
- `process.env.NODE_ENV` (§2.9)
- JavaScript exceptions for error handling (§2.8)
- Object/closure allocations in APIs (§2.5, §2.6, §2.7)
- String-based type discrimination

**Fix**: All kernel-internal remediation tasks above are tagged as Rust-port prerequisites. No additional work needed beyond executing them. This entry serves as a tracking flag — when all items in §2 are complete, the kernel is Rust-port ready at the API boundary level.

### 2.15 FreeList / LocalAllocator SPSC Hygiene

**Problem**: `allocNode()` and `freeNode()` warn but don't prevent cross-context calls. A main-thread `allocNode()` call would corrupt the free list.

**Fix**: In production builds, hard-fail (return `NIL` / error code) instead of `console.warn`. Debug builds can additionally log. This is gated on the same `HDR.DEBUG_FLAGS` mechanism from §2.9.

## 3. Composer Layer Remediation

### 3.1 SynapticClip Refactor
-   **Remove Operations Array**: Delete `protected operations: Operation[]` and all `.push()` logic.
-   **Flatten State**: Replace all state objects with primitive fields:
    -   `activeDynamics` -> `_dynType`, `_dynStart`, `_dynDuration`, `_dynFrom`, `_dynTo`.
    -   `scaleContext` -> `_scaleRoot`, `_scaleMode`.
    -   `_humanizeSettings` -> `_humVel`, `_humTiming`.
-   **Refactor `flushNote`**: Rewrite to calculate final values from primitive state and call `bridge.insertAsync` directly.

### 3.2 Method Categories

**One-Shot Methods (Direct Flush)**:
Methods that immediately write to Kernel and return `this` (the Clip):

| Method | Kernel Action |
|--------|---------------|
| `transpose(n)` | `Atomics.store(sab, REG.TRANSPOSE, n)` |
| `tempo(bpm)` | `Atomics.store(sab, HDR.BPM, bpm)` |
| `cc(num, val)` | `bridge.insertAsync(OPCODE.CC, ...)` |
| `pitchBend(val)` | `bridge.insertAsync(OPCODE.BEND, ...)` |
| `rest(dur)` | Advance internal tick (or emit REST node) |

No cursor. No buffering. Fire immediately.

**Cursor-Based Methods (Deferred Commit)**:
Methods that branch to a singleton cursor, accumulate modifiers, then commit implicitly:

```
clip.note(60)       // → cursor (sets pitch=60)
    .velocity(0.8)  // → cursor (sets _velocity=0.8)
    .staccato()     // → cursor (sets _duration *= 0.5)
    .note(62)       // → IMPLICIT COMMIT: flush to Kernel, reset, delegate
```

### 3.3 Cursor Optimization
-   **Lifecycle**: `SynapticClip` initializes `_noteCursor` and `_chordCursor` in its constructor.
-   **Re-entry**: `clip.note(pitch)` resets `_noteCursor` state (pitch, velocity, duration) and returns it.
-   **Commit**: `cursor.commit()` calls `clip.flushNote(...)` and resets pending state.

### 3.4 Cursor Architecture: Parallel Hierarchy

**Decision**: Use a **parallel class hierarchy** for cursors that mirrors the Clip hierarchy.

**Rationale**:
-   **No Proxies**: Avoids runtime magic. Performance-conscious developers won't be suspicious.
-   **No Traits/Mixins**: Avoids TypeScript complexity and hidden behavior.
-   **Explicit & Verbose**: Each cursor subclass explicitly lists its escape methods. This is the cheapest tradeoff.

**Structure**:
```
BaseClip                    ->  BaseNoteCursor<TClip>
  ├─ MelodyClip             ->    ├─ MelodyNoteCursor
  ├─ StringsClip            ->    ├─ StringsNoteCursor
  └─ KeyboardClip           ->    └─ KeyboardNoteCursor
```

**Escape Method Pattern**:
```typescript
class MelodyNoteCursor extends BaseNoteCursor<MelodyClip> {
  // Modifier (stays on cursor)
  velocity(v: number): this { this._velocity = v; return this; }

  // Escape (commits + delegates to clip)
  note(pitch: number): MelodyNoteCursor {
    this.commit();
    return this.clip.note(pitch);
  }
}
```

**Inheritance Strategy**:
-   **BaseNoteCursor**: Contains common modifiers (`velocity`, `staccato`, `articulation`) and common escapes (`rest`, `cc`, `pitchBend`).
-   **Subclasses**: Add only clip-specific escapes (`note`, `chord`, `bow`, `pizzicato`, etc.).

## 4. Implementation Tasks

> **Full task specifications:** [tasks/INDEX.md](./tasks/INDEX.md)

### Phase 0: Kernel Internals

| Task | Priority | Description | Ref |
|------|----------|-------------|-----|
| 071 | 🔴 CRITICAL | SEQ counter wraparound — modular distance check in SeqLock readers | §2.3 |
| 072 | 🔴 CRITICAL | SynapseAllocator singleton — delete duplicate in SiliconSynapse | §2.4 |
| 073 | 🔴 CRITICAL | Replace `readNode`/`traverse` with `readNodeRaw` + consumer loops | §2.6 |
| 074 | 🟠 HIGH | `patchMultiple` — positional params, delete object signature | §2.5 |
| 075 | 🟠 HIGH | `writeOrSpin` — return error code, delete exception throw | §2.8 |
| 076 | 🟠 HIGH | `getZoneBStats` — bit-packed return, delete object return | §2.7 |
| 077 | 🟠 HIGH | Eliminate `process.env.NODE_ENV` — use `HDR.DEBUG_FLAGS` | §2.9 |
| 078 | 🟠 HIGH | Standardize hash probing to quadratic (Identity + Symbol tables) | §2.10 |
| 079 | 🟠 HIGH | `validateLinkerSAB` — read capacity/zones from SAB header | §2.12 |
| 080 | 🟡 MEDIUM | SPSC hard-fail in production for cross-context alloc/free | §2.15 |
| 081 | 🟡 MEDIUM | Delete `getSAB` dead JSDoc | §2.13 |
| 082 | 🟡 MEDIUM | Flag SiliconBridge for decomposition (future task) | §2.11 |

### Phase 1: Foundation

| Task | Priority | Description |
|------|----------|-------------|
| 060 | 🔴 CRITICAL | Kernel Backpressure (64k buffer + Spin-Wait) |
| 059 | 🟠 HIGH | Define numeric Enums for Dynamics, Curves, Modes |
| 069 | 🟠 HIGH | Mark Session/Track as design-time builders |

### Phase 2: Core Remediation

| Task | Priority | Description |
|------|----------|-------------|
| 057 | 🔴 CRITICAL | Flatten SynapticClip state to primitives |
| 066 | 🟠 HIGH | Refactor SynapticDrums drum map to Uint8Array |
| 070 | 🟠 HIGH | Refactor key.ts utilities (out-parameter pattern) |
| 068 | 🟠 HIGH | Refactor SynapticGrooveBuilder allocations |

### Phase 3: Operations Removal

| Task | Priority | Description |
|------|----------|-------------|
| 058 | 🔴 CRITICAL | Remove operations[] array entirely |
| 063 | 🟠 HIGH | Remove isolate() closures (pushState/popState) |
| 067 | 🟠 HIGH | Decide FrozenClip fate (delete/refactor/mark) |

### Phase 4: API Refactoring

| Task | Priority | Description |
|------|----------|-------------|
| 061 | 🟠 HIGH | Refactor Cursors to Parallel Hierarchy |
| 062 | 🟠 HIGH | Refactor One-Shot Methods to Direct-to-Kernel |
| 064 | 🔴 CRITICAL | Refactor SynapticMelody chord/voicing methods |
| 065 | 🟠 HIGH | Refactor loop/play/progression methods |

## 5. Verification
-   **Correctness**: Verify strict 1:1 mapping between API calls and Kernel commands.
-   **Memory**: Profile heap usage during a high-throughput loop (100k notes). Allocations should be effectively zero (GC flatline).
-   **Reliability**: Stress test with >65k burst edits to trigger and verify Spin-Wait behavior.
-   **SEQ Wraparound**: Synthetically advance SEQ counter to `0xFFFFFE`, perform patches, verify SeqLock reads remain valid across the wrap boundary.
-   **readNodeRaw**: Benchmark per-node read latency vs. old callback path. Target ≥30% improvement.
-   **Error Codes**: Verify `writeOrSpin` timeout returns error code (not exception) and sets `HDR.ERROR_FLAG` atomically.
-   **Singleton SynapseAllocator**: Confirm only one `SynapseAllocator` instance exists at runtime; `usedSlots`/`tombstoneCount` stay consistent across all synapse operations.

---

## Appendix A: Comprehensive Violations Audit

### A.1 SynapticClip.ts (Core Clip Base)

| Violation | Description | Severity |
|-----------|-------------|----------|
| `operations: Operation[]` | Array stores all operations; must be removed | 🔴 Critical |
| `operations.push({...})` | Object literal allocation on every note/cc | 🔴 Critical |
| `activeDynamics` object | Stores `{ type, start, duration, from, to }` as object | 🔴 Critical |
| `scaleContext` object | Stores `{ root, mode, octave }` as object | 🔴 Critical |
| `_humanizeSettings` object | Stores `{ velocity, timing }` as object | 🔴 Critical |
| `isolate()` closures | Creates callback closures for temp state | 🟠 High |
| `freeze()` → `new FrozenClip()` | Allocates new object | 🟠 High |
| `build()` → `{ ... }` | Allocates ClipNode object literal | 🟠 High |

---

### A.2 SynapticMelody.ts (Melody Builder)

| Violation | Description | Severity |
|-----------|-------------|----------|
| Inherits all `SynapticClip` violations | | 🔴 Critical |
| `chordSymbolToPitches()` returns `number[]` | Allocates new array per chord | 🔴 Critical |
| `findBestVoicing()` returns `number[]` | Allocates new array for best voicing | 🔴 Critical |
| `voiceLead()` allocates `let previousVoicing: number[] = []` | Array allocation in loop | 🔴 Critical |
| `loop()` takes callback `(clip) => void` | Closure allocation per loop | 🟠 High |
| `progression()` options object `{ duration?: number }` | Object parameter | 🟠 High |

---

### A.3 SynapticDrums.ts (Drum Builder)

| Violation | Description | Severity |
|-----------|-------------|----------|
| `_drumMap = { ...DEFAULT_DRUM_MAP }` | Object spread allocation in constructor | 🟠 High |
| `withMapping()` → `{ ...this._drumMap, ...mapping }` | Object spread on every call | 🟠 High |
| `euclidean()` options object | Object parameter | 🟠 High |
| Inherits all `SynapticClip` violations | | 🔴 Critical |

---

### A.4 FrozenClip.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `toOperations()` → `[...clipNode.operations]` | Array spread allocation | 🟠 High |
| `filter()` in `duration` getter | Creates new filtered array | 🟠 High |
| `filter()` in `noteCount` getter | Creates new filtered array | 🟠 High |
| Stores `ClipNode` which has `operations[]` | Entire class is allocation-centric | 🟠 High |

---

### A.5 SynapticGrooveBuilder.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `build()` → `{ ... }` object literal | Allocates GrooveTemplate object | 🟠 High |
| `.slice()` on Float32Arrays | Creates new typed arrays | 🟠 High |

---

### A.6 Session.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `tracks: TrackNode[] = []` | Array allocation | 🟠 High |
| `buses: EffectBusConfig[] = []` | Array allocation | 🟠 High |
| `tracks.push(...)` | Array mutation | 🟠 High |
| `buses.push(...)` | Array mutation | 🟠 High |
| `build()` → `{ ...tracks: [...this.tracks] }` | Object + array spread | 🟠 High |
| `timeSignature: [number, number]` | Tuple allocation | 🟠 High |

---

### A.7 Track.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `insertEffects: InsertEffect[] = []` | Array allocation | 🟠 High |
| `sendConfigs: SendConfig[] = []` | Array allocation | 🟠 High |
| `insertEffects.push(...)` | Array mutation | 🟠 High |
| `sendConfigs.push(...)` | Array mutation | 🟠 High |
| `build()` → `{ ...inserts: [...this.insertEffects] }` | Object + array spread | 🟠 High |
| `timeSignature: [number, number]` | Tuple allocation | 🟠 High |

---

### A.8 Cursors (SynapticMelodyNoteCursor, SynapticChordCursor, etc.)

| Violation | Description | Severity |
|-----------|-------------|----------|
| Calls `clip.flushNote()` which pushes to `operations[]` | Inherits clip's allocation violation | 🔴 Critical |
| Missing escape method pattern | Must implement implicit commit + delegate | 🟠 High |
| Current hierarchy doesn't match new parallel design | Need `MelodyNoteCursor`, `DrumsHitCursor`, etc. | 🟠 High |
| `SynapticChordCursor.pitches[]` | Pre-allocated array in constructor | ✅ OK |

> **Note**: Cursors need full refactoring to align with Direct-to-Kernel architecture and parallel hierarchy pattern.

---

### A.9 Utils

#### chord.ts ✅ Clean
- Uses module-level `CHORD_RESULT` reusable object.
- `parseChord()` writes to out-parameter.

#### key.ts
| Violation | Description | Severity |
|-----------|-------------|----------|
| `parseNoteName()` returns `{ letter, accidental, octave }` | Object allocation per note | 🟠 High |
| `applyKeySignature()` calls `parseNoteName()` | Object allocation per call | 🟠 High |
| Template string interpolation `${...}` | String allocation | 🟠 High |

#### pitch.ts, scales.ts, romanAdapter.ts
- **TODO**: Audit for similar violations.

---

### A.10 types.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| String-based types (`'major' | 'minor'`, `'sharp' | 'flat'`) | Should be numeric enums | 🟠 High |
| Object interfaces (`ScaleContext`, `KeyContext`, `DegreeOptions`) | Forces object allocation | 🔴 Critical |
| `ClipNode.operations[]` | Core violation: array-centric design | 🔴 Critical |

---

## Appendix B: Kernel-Internal Violations Audit

### B.1 silicon-synapse.ts

| Violation | Description | Severity | Fix Ref |
|-----------|-------------|----------|---------|
| `patchMultiple(ptr, patches: Record<number, number>)` | Object param forces heap allocation per call | 🔴 Critical | §2.5 |
| `readNode(ptr, cb)` with 10-arg callback | Function dispatch + full unpack overhead per node | 🔴 Critical | §2.6 |
| `traverse(head, cb)` with 10-arg callback | Same as `readNode`, in a loop | 🔴 Critical | §2.6 |
| SEQ counter in `SEQ_FLAGS` bits 8–31 | Wraps at ~16.7M, no modular distance check | 🔴 Critical | §2.3 |
| Duplicate `SynapseAllocator` instantiation | Instance state diverges from Bridge's allocator | 🔴 Critical | §2.4 |
| Linear probing in Identity/Symbol tables | Inconsistent with Synapse Table's quadratic probing | 🟠 High | §2.10 |
| `process.env.NODE_ENV` in hot path | Node.js-ism, string compare, non-portable | 🟠 High | §2.9 |

### B.2 silicon-bridge.ts

| Violation | Description | Severity | Fix Ref |
|-----------|-------------|----------|---------|
| `writeOrSpin` throws `new Error(...)` | Heap allocation, forces try/catch, Rust-incompatible | 🔴 Critical | §2.8 |
| `getZoneBStats()` returns `{ allocated, capacity, utilization }` | Object allocation on every call | 🟠 High | §2.7 |
| `getSAB()` dead JSDoc, no body | Dead code | 🟡 Medium | §2.13 |
| 1,400+ line god class | Too many responsibilities, hard to test/port | 🟡 Medium | §2.11 |

### B.3 init.ts

| Violation | Description | Severity | Fix Ref |
|-----------|-------------|----------|---------|
| `validateLinkerSAB` uses hardcoded defaults | Fails for non-default capacity or multi-zone SABs | 🟠 High | §2.12 |

### B.4 free-list.ts

| Violation | Description | Severity | Fix Ref |
|-----------|-------------|----------|---------|
| `allocNode` cross-context `console.warn` only | Should hard-fail (return `NIL`) in production | 🟠 High | §2.15 |
| `process.env.NODE_ENV` guard | Same as silicon-synapse.ts | 🟠 High | §2.9 |

---

## Appendix C: Severity Legend

| Icon | Severity | Action |
|------|----------|--------|
| 🔴 | **Critical** | Must fix first. Blocks production and Rust port. |
| 🟠 | **High** | Must fix. No exceptions. |
| 🟡 | **Medium** | Fix when touching the file. Flag for future. |
| ✅ | **OK** | No action needed. |

