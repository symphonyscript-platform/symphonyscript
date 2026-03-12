## What is `SiliconSynapse`?

`SiliconSynapse` is the **Memory Management Unit (MMU)** at the core of the SymphonyScript kernel. It's essentially a **lock-free, real-time-safe data engine** that manages a linked list of musical events (MIDI notes) stored inside a `SharedArrayBuffer` (SAB) — a chunk of raw binary memory shared between the browser's **main thread** and an **AudioWorklet** (real-time audio thread).

Think of it as a custom mini operating system kernel, but for music data instead of processes.

---

## The Big Picture Architecture

The system follows a **"Direct-to-Silicon Mirroring"** pattern (as described in their RFC-043):

```
Main Thread (Editor/UI)           AudioWorklet (Real-time Audio)
        │                                     │
        │  writes commands to ──────►         │  reads commands from
        │  Ring Buffer (SAB)                  │  Ring Buffer (SAB)
        │                                     │
        └──── SharedArrayBuffer ──────────────┘
              (the "Silicon" — raw i32 memory)
```

The main thread (via `SiliconBridge`) sends commands like INSERT, DELETE, CONNECT through a **lock-free ring buffer** into the SAB. The audio thread (via `SiliconSynapse.poll()`) reads and executes those commands. Both threads operate on the **same memory** without copying — that's the "direct-to-silicon" part.

---

## How It Works — The Key Subsystems

### 1. Memory Layout (the SAB)

The `SharedArrayBuffer` is organized into a flat binary layout viewed as `Int32Array`:

- **Header region** (bytes 0-128): Metadata — magic number, version, BPM, playhead position, error flags, node counts, etc.
- **Register bank**: Global parameters like groove, humanization, transpose.
- **Node heap**: A fixed-capacity pool of 32-byte "nodes" (8 × i32 each). Each node represents a musical event (note-on, etc.) with packed fields for opcode, pitch, velocity, flags, duration, tick position, and doubly-linked-list pointers.
- **Identity Table**: A hash map (open-addressing, triangular probing) mapping `sourceId → NodePtr` for O(1) lookups by editor ID.
- **Symbol Table**: Parallel to the Identity Table — maps `sourceId → SourceLocation` (file, line, column) for editor integration.
- **Synapse Table**: Connections between nodes (for "Silicon Brain" features — neural-style note triggering).
- **Ring Buffer**: SPSC (single-producer, single-consumer) command queue.

### 2. Node Allocation (Free List)

Nodes are allocated from a **lock-free free list**:

```typescript
allocNode(): NodePtr    // pop from free list → returns byte offset
freeNode(ptr): void     // push back to free list
```

The heap is split into two zones:
- **Zone A** (worker-owned): Nodes allocated by the audio worker, returned to the free list on delete.
- **Zone B** (main-thread-owned): Nodes allocated by `LocalAllocator` on the main thread via bump allocation. On delete, these go into a **reclaim ring** instead of the free list (to avoid cross-thread free-list contention).

### 3. Concurrency Model

This is where it gets really clever. The system uses **three** concurrency mechanisms:

**a) Chain Mutex (CAS spin-lock)** — protects structural mutations (insert/delete):

```42:43:packages/kernel/src/silicon-synapse.ts
// ... context-aware behavior
```

- In **audio context**: Max 3 CAS spins (~300ns), never blocks, returns false on contention.
- In **main thread context**: Full spin-wait with `Atomics.wait()` yields, panics on deadlock.

**b) SeqLock** — for consistent reads without blocking:

```1062:1094:packages/kernel/src/silicon-synapse.ts
  readNodeRaw(ptr: NodePtr, buf: Int32Array): boolean {
    // ...
    while (retries < MAX_SPINS) {
      const seq1 = (Atomics.load(this.sab, offset + NODE.SEQ_FLAGS) & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT
      // ... read all 8 fields ...
      const seq2 = (buf[6] & SEQ.SEQ_MASK) >>> SEQ.SEQ_SHIFT
      if (!seqChanged(seq1, seq2)) {
        return true  // consistent snapshot!
      }
      retries = retries + 1
    }
    return false
  }
```

Reads the sequence number before and after loading fields. If it changed, a writer was mid-update, so it retries.

**c) SPSC Ring Buffer** — the main thread writes commands, the audio thread reads them. No locks at all — just atomic head/tail pointers.

### 4. Command Processing

The audio thread calls `poll()` (or `processCommands()`) each audio frame. It drains the ring buffer and executes commands:

```1923:1953:packages/kernel/src/silicon-synapse.ts
      switch (opcode) {
        case CMD.INSERT:
          this.executeInsert(param1, param2)
          break
        case CMD.DELETE:
          this.executeDelete(param1)
          break
        case CMD.CLEAR:
          this.executeClear()
          break
        // ... CONNECT, DISCONNECT for synapse operations
      }
```

Max 256 commands per cycle to prevent audio starvation.

### 5. Attribute Patching

Simple field updates (pitch, velocity, duration) bypass the ring buffer entirely — they use **immediate atomic writes** via the `AttributePatcher`. This is sub-microsecond because there's no structural change, just overwriting a field with a SeqLock bump.

### 6. Safe Zone Enforcement

A "safe zone" around the playhead prevents edits too close to what the audio thread is currently reading:

```723:733:packages/kernel/src/silicon-synapse.ts
  private checkSafeZone(targetTick: number): boolean {
    const playhead = Atomics.load(this.sab, HDR.PLAYHEAD_TICK)
    const safeZone = Atomics.load(this.sab, HDR.SAFE_ZONE_TICKS)
    if (targetTick - playhead < safeZone && targetTick >= playhead) {
      Atomics.store(this.sab, HDR.ERROR_FLAG, ERROR.SAFE_ZONE)
      return false
    }
    return true
  }
```

Default is 960 ticks (2 beats at 480 PPQ) — you can't insert/delete a note that's about to be played.

### 7. Identity & Symbol Tables

These are **open-addressing hash tables** stored directly in the SAB using triangular number probing (full coverage guaranteed for power-of-2 capacities). The Identity Table maps editor `sourceId` values to raw byte pointers, enabling O(1) lookups when the editor needs to find a specific note. The Symbol Table stores source locations (file + line + column) for debugging.

### 8. Synapse Table

This supports a "Silicon Brain" feature — neural-style connections between nodes. When one note finishes playing, its synapses can trigger other notes, with weights and jitter. The `CONNECT` and `DISCONNECT` commands manage these connections.

---

## Zero-Allocation Philosophy

The entire file is obsessively **zero-allocation**:
- No `new` objects in hot paths
- No `throw` / `try-catch` (error codes via `Atomics.store` instead)
- No `for...of`, no Maps, no Sets
- Pre-allocated scratch buffers (e.g., `this.commandBuffer = new Int32Array(4)`)
- While loops with index variables instead of iterators
- Callback-based lookup (`symTableLookup`) instead of returning objects

This is because the code runs in an **AudioWorklet**, where any garbage collection pause causes audible glitches. Even a 1ms GC pause at 44.1kHz = ~44 samples of silence.

---

## In Summary

`SiliconSynapse` is a **real-time, lock-free, zero-allocation memory management kernel** for a music sequencer. It lets the UI thread and audio thread operate on the same musical data simultaneously without copying, blocking, or allocating — using `SharedArrayBuffer` + `Atomics` as the shared substrate. It's essentially building the guarantees of a real-time OS scheduler, but in pure JavaScript/TypeScript, running in a browser.
