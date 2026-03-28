# SymphonyScript Kernel: Hybrid Triple-Buffer Architecture

## 1. The Problem

The SymphonyScript kernel must share a mutable audio graph between two threads:

- **Main thread** (writer): inserts/removes nodes, patches attributes (pitch, velocity), updates routing topology
- **Audio thread** (reader): traverses the graph every ~2.9ms (128 samples @ 44.1kHz), reads node data, produces audio output

These threads cannot use locks. A mutex held by the main thread would cause the audio thread to block — a buffer underrun, an audible glitch. The kernel needs a **lock-free synchronization primitive** that gives the audio thread a consistent, always-readable snapshot of the graph while the main thread mutates it freely.

---

## 2. Alternatives Considered

### 2.1 Command Ring Buffer (SPSC Queue)

```
MAIN THREAD                          AUDIO THREAD
    │                                     │
    ├─ push(InsertNode{...})              │
    ├─ push(PatchVelocity{42, 80})        │
    ├─ push(RemoveNode{17})               ├─ pop() → InsertNode
    │                                     ├─ pop() → PatchVelocity
    │                                     ├─ pop() → RemoveNode
    │                                     ├─ apply mutations to local graph
    │                                     └─ render audio from graph
```

**How it works:** Main thread pushes commands into a lock-free SPSC ring buffer. Audio thread pops and applies them at the start of each callback before rendering.

**Why rejected:**

| Issue | Impact |
|---|---|
| Audio thread **mutates** the graph | The reader is also a writer — violates pure-reader principle |
| Command protocol design | Every mutation type needs a serializable command enum, dispatch logic, apply logic |
| Overflow risk | Ring buffer is fixed-size; burst of commands can overflow → dropped mutations |
| Ordering complexity | Commands must be applied in exact order; partial application = inconsistent state |
| Processing budget | Audio thread spends cycles on command dispatch instead of DSP |
| No atomic consistency | Commands applied one-by-one; graph is inconsistent mid-batch |

**Bottom line:** Turns the audio thread into a state machine. Adds protocol complexity, overflow handling, and mutation code on the most latency-constrained thread in the system. We built this. We're throwing it away.

---

### 2.2 SeqLock (Sequence Lock)

```
MAIN THREAD                          AUDIO THREAD
    │                                     │
    ├─ seq.store(seq + 1)  // odd = writing    │
    ├─ write data                         │
    ├─ seq.store(seq + 1)  // even = done      ├─ loop:
    │                                     │     s1 = seq.load()
    │                                     │     if s1 & 1: retry (writer active)
    │                                     │     read data
    │                                     │     s2 = seq.load()
    │                                     │     if s1 != s2: retry (data changed)
    │                                     │     break
```

**How it works:** A sequence counter protects shared data. Writer increments before and after writes. Reader checks the counter before and after reads — if it changed or is odd, the read was torn and must retry.

**Why rejected:**

| Issue | Impact |
|---|---|
| Reader **retries** on contention | Audio thread may spin indefinitely if writer is active |
| Per-field or per-region locking | Must wrap every read site in a SeqLock check — invasive |
| Scales poorly with graph size | Traversing 50+ nodes with SeqLock checks per node = retry storm |
| No transactional consistency | Protecting individual fields doesn't protect cross-field invariants |
| Hot-path branching | Every read has a conditional retry loop — branch misprediction noise |

**Bottom line:** Works for single-value sharing (e.g., one timestamp). Breaks down for graph traversal where you need consistent reads across many linked nodes simultaneously. Retry on the audio thread is unacceptable.

---

### 2.3 RCU / Epoch-Based Reclamation

```
MAIN THREAD                          AUDIO THREAD
    │                                     │
    ├─ new_graph = clone(old_graph)        ├─ epoch_enter()
    ├─ mutate(new_graph)                   ├─ graph = current.load()
    ├─ current.store(new_graph)            ├─ traverse(graph)
    ├─ defer_free(old_graph, epoch)        ├─ epoch_exit()
    │                                     │
    ├─ ... later, when all readers         │
    │   have exited the epoch ...          │
    ├─ free(old_graph)                     │
```

**How it works:** Writer clones the graph, mutates the copy, swaps a pointer. Old graph is freed when all readers have exited the current epoch.

**Why rejected:**

| Issue | Impact |
|---|---|
| **Allocation on every mutation** | Clone = heap allocation. In Rust, no allocator is truly real-time safe |
| Epoch tracking complexity | Must track which readers are in which epoch. Hazard pointers or epoch counters |
| Deferred free queue | Garbage accumulates until epoch advances. Unbounded memory growth possible |
| Clone cost | Cloning a 640KB graph = ~50-100µs + allocation |
| Over-engineered for our case | RCU solves many-reader-many-writer. We have exactly one reader and one writer |

**Bottom line:** Designed for kernel data structures with many concurrent readers and infrequent writers. Massive overkill for SPSC audio. The allocation and reclamation machinery is the exact kind of unbounded-latency code that doesn't belong near real-time audio.

---

### 2.4 Double-Buffer (Ping-Pong)

```
MAIN THREAD                          AUDIO THREAD
    │                                     │
    │  ACTIVE_FRAME = 0                   │
    │                                     ├─ frame = ACTIVE_FRAME.load()
    ├─ dual-write data to BOTH frames     ├─ traverse Frame[frame]
    ├─ structural write to INACTIVE only  ├─ read pitch, velocity...
    ├─ append to structural_log           │
    │                                     │
    ├─ swap(): ACTIVE_FRAME.store(1)      │
    │                                     ├─ frame = ACTIVE_FRAME.load()
    │  ... later ...                      ├─ traverse Frame[1] (new)
    ├─ begin_mutations():                 │
    │   replay structural_log on Frame 0  │
    │   return deferred frees             │
    ├─ write next batch to Frame 0        │
```

**How it works:** Two permanent pre-allocated frames. Audio reads the active frame. Main writes structural changes to the inactive frame, dual-writes data patches to both frames. Swap flips an atomic integer. After swap, main replays the structural log on the now-stale frame to synchronize it.

**Strengths:**

| Dimension | Assessment |
|---|---|
| Audio read cost | 1 atomic load. Cheapest possible. |
| Cache layout | AoS — one cache line per node, all fields together |
| Sync cost | 150ns structural log replay |
| Data patches | Instant via dual-write |
| Memory | 2× frame (~1.3MB for two 640KB frames) |

**Weaknesses — why we ultimately rejected it:**

| Issue | Severity | Detail |
|---|---|---|
| `begin_mutations()` timing | **Architectural** | After `swap()`, the stale frame may still be read by audio if the callback is mid-execution. Main thread must confirm audio has moved to the new frame before writing to the stale one. This requires a generation counter and a **policy decision**: what to do when the check fails (spin? queue? error?). Every answer adds complexity. |
| Structural log correctness | Medium | Every structural mutation must append to the log. Every replay must be ordered correctly. A missed entry = silent frame divergence — the two frames represent different graphs. |
| Dual-write discipline | Medium | Every data patch must write to both frames. One missed write = silent divergence after swap. Encapsulation mitigates this, but the invariant exists. |
| Deferred free timing | Medium | Slots can only return to the free list after swap AND after audio has abandoned the old frame. Another timing dependency. |
| Silent failure mode | **Architectural** | When invariants are violated, the system doesn't crash — it plays wrong notes after the next swap. This is extremely hard to detect, reproduce, and debug. |

**The decisive flaw — `begin_mutations()` policy question:**

```
fn begin_mutations(&mut self) {
    if audio_generation.load(Acquire) <= self.swap_generation {
        // Writer-reader coupling. Audio hasn't finished with old frame.
        //
        // Options, all with consequences:
        //   spin-wait  → blocks main thread, defeats lock-free purpose
        //   return Err → caller must handle retry, adds API complexity
        //   queue ops  → adds a mutation queue, more state to manage
        //   assert     → UB in release, crash in debug
        //
        // This question doesn't exist in triple-buffer.
    }
}
```

**Bottom line:** Double-buffer is fast, low-overhead, and technically sound. But it has 5 correctness invariants, silent failure modes, and a policy question (`begin_mutations()` timing) that introduces conditional logic into what should be an unconditional protocol. Between two architectures with marginal performance differences, the one with an unconditional write path and visible failure modes wins.

---

### 2.5 Triple-Buffer (Selected)

Covered in full in Section 3 below.

---

## 3. Selected Architecture: Hybrid Triple-Buffer

### 3.1 Core Concept

The data is split into **two planes** based on consistency requirements:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SHARED ATTRIBUTE PLANE              STRUCTURAL TRIPLE-BUFFER  │
│   (single copy)                       (3 copies)                │
│                                                                 │
│   ┌───────────────────────┐           ┌──────────┐              │
│   │ pitch     [AtomicI32] │           │ WRITER   │ ← main owns  │
│   │ velocity  [AtomicI32] │           │ next_ptr │              │
│   │ duration  [AtomicI32] │           │ prev_ptr │              │
│   │ volume    [AtomicI32] │           │ head     │              │
│   │ pan       [AtomicI32] │           │ mod_head │              │
│   │ mod_depth [AtomicI32] │           │ synapses │              │
│   │ ...                   │           ├──────────┤              │
│   └───────────────────────┘           │ SHARED   │ ← staging    │
│                                       │  (same)  │              │
│   Main writes → Audio reads           ├──────────┤              │
│   Instant. No swap needed.            │ READER   │ ← audio owns │
│                                       │  (same)  │              │
│                                       └──────────┘              │
│                                                                 │
│                                       Main writes WRITER only.  │
│                                       Swaps WRITER↔SHARED.      │
│                                       Audio swaps SHARED↔READER.│
│                                       Full decoupling.          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The split rule:** If changing a field while audio is mid-read can corrupt graph traversal → **structural plane.** Everything else → **attribute plane.**

```
STRUCTURAL (triple-buffered):           ATTRIBUTE (shared, atomic):
  ├─ next_ptr                             ├─ pitch
  ├─ prev_ptr                             ├─ velocity
  ├─ head_ptr                             ├─ duration
  ├─ mod_list_head                        ├─ volume
  ├─ synapse routing                      ├─ pan
  └─ hash table slots                     ├─ mod_depth
                                          ├─ param values
                                          └─ LUT indices
```

### 3.2 Triple-Buffer Protocol

Three buffers exist. Each has exactly one role at any moment:

```
         WRITER              SHARED              READER
       (main owns)         (staging)           (audio owns)
      ┌──────────┐        ┌──────────┐        ┌──────────┐
      │          │        │ latest   │        │          │
      │  main    │        │ complete │        │  audio   │
      │  writes  │        │ frame    │        │  reads   │
      │  here    │        │ from     │        │  here    │
      │          │        │ writer   │        │          │
      └──────────┘        └──────────┘        └──────────┘

  KEY INVARIANT: No buffer is touched by both threads simultaneously.
  Writer and Reader never access the same buffer. Shared is only
  touched during the atomic swap itself.
```

**Writer swap (main thread — after completing a batch of structural mutations):**

```
Before:  Writer=A  Shared=B  Reader=C

  main does atomic swap: Writer ↔ Shared
  main gets back B as new workspace
  A (just published) sits in Shared

After:   Writer=B  Shared=A  Reader=C

  main now writes to B
  A waits for audio to pick it up
  audio still reads C (undisturbed)
```

**Reader swap (audio thread — at start of each callback):**

```
Before:  Writer=B  Shared=A  Reader=C

  audio does atomic swap: swap Reader ↔ Shared
  audio gets A (latest from main)
  C goes to Shared (stale, will be reused)

After:   Writer=B  Shared=C  Reader=A

  audio reads A (latest structural frame)
  main writes to B (undisturbed)
  C sits in Shared (will go back to writer on next writer swap)
```

**Full cycle:**

```
TIME ──────────────────────────────────────────────────────────►

State 0:  W=A   S=B   R=C     main writes A, audio reads C
          │                    
          ├─ main finishes writing A
          ├─ writer swap: W↔S
          │
State 1:  W=B   S=A   R=C     main writes B, audio reads C
          │                     A staged for audio
          ├─ audio callback fires
          ├─ reader swap: S↔R
          │
State 2:  W=B   S=C   R=A     main writes B, audio reads A ← latest!
          │                     C returns to staging
          ├─ main finishes writing B
          ├─ writer swap: W↔S
          │
State 3:  W=C   S=B   R=A     main writes C, audio reads A
          │                     B staged for audio
          ...
```

### 3.3 Atomic State Encoding

The triple-buffer state is stored as an `AtomicI32` slot on the SAB:

```
┌─────────────────────────────────────────┐
│  AtomicI32 state (on SAB)               │
│                                         │
│  bits [0:1]  = shared buffer index      │
│               (0, 1, or 2)              │
│                                         │
│  bit  [2]    = NEW_DATA flag            │
│               1 = writer published      │
│               0 = reader consumed       │
│                                         │
│  Examples:                              │
│    0b000 = shared=0, no new data        │
│    0b101 = shared=1, new data ready     │
│    0b110 = shared=2, new data ready     │
└─────────────────────────────────────────┘
```

> **Implementation deviation:** The design originally specified `AtomicU8` and `CAS` loops.
> The implementation uses `AtomicI32` (to match SAB's element type) and `swap()` instead
> of `CAS`. This is correct because:
> 1. Both writer and reader compute new_state independently of current shared state
> 2. In SPSC, no competing writers/readers exist, so swap is safe and retry-free
> 3. swap() compiles to a single XCHG instruction — no retry loops, no livelock risk

**Writer publish (Rust — actual implementation):**

```rust
fn publish(&mut self) {
    let current_id = self.sab[self.writer_slot_index].load(Relaxed);
    let new_state = (current_id & 0b011) | 0b100;

    // swap: unconditionally deposit our buffer and set NEW_DATA.
    // writer's new_state is independent of shared state → swap, not CAS.
    let old_state = self.sab[self.state_slot_index].swap(new_state, Release);
    let writer_new_buffer_id = old_state & 0b011;

    self.sab[self.writer_slot_index].store(writer_new_buffer_id, Relaxed);
    self.sab[self.published_slot_index].store(current_id, Relaxed);

    // Sync stale writer buffer via unsafe memcpy (~4.7µs for 104KB)
    let src = self.sab[published_base..].as_ptr() as *const i32;
    let dst = self.sab[writer_base..].as_ptr() as *mut i32;
    unsafe { std::ptr::copy_nonoverlapping(src, dst, self.buffer_size); }
}
```

**Reader swap (Rust — actual implementation):**

```rust
fn swap(&mut self) -> bool {
    // Non-destructive peek: must check before committing.
    let state = self.sab[self.state_slot_index].load(Relaxed);
    if state & 0b100 == 0 {
        return false; // no new data
    }

    let current_id = self.sab[self.reader_slot_index].load(Relaxed);
    let new_state = current_id & 0b011;

    // swap: unconditionally deposit our buffer and clear NEW_DATA.
    // old_state (not loaded `state`) determines which buffer was acquired,
    // since state may be stale by this point.
    let old_state = self.sab[self.state_slot_index].swap(new_state, Acquire);
    self.sab[self.reader_slot_index].store(old_state & 0b011, Relaxed);

    true
}
```

**Memory ordering rationale:**
- Writer uses `Release` — ensures all writes to the buffer are visible before publishing
- Reader uses `Acquire` — ensures it sees all writer's stores after picking up the buffer
- `Release`/`Acquire` pair forms a happens-before relationship across the shared state

### 3.4 Audio Thread Read Path

```rust
fn process(&mut self, output: &mut [f32]) {
    // 1. Grab latest structural frame (one swap, ~11ns)
    self.reader.swap();

    // 2. Walk node chain using structural indices on SAB
    let reader_base = self.reader.current_start_index();
    let mut slot = self.sab[reader_base + HEAD_OFFSET].load(Relaxed) as usize;
    while slot != NONE {
        // 3. Structural data from triple-buffered SAB region
        let next = self.sab[reader_base + slot * 2].load(Relaxed);
        let prev = self.sab[reader_base + slot * 2 + 1].load(Relaxed);

        // 4. Attribute data DIRECTLY from shared plane (atomic load, ~1ns each)
        let pitch    = self.sab[attr_base + slot * ATTR_STRIDE + PITCH].load(Relaxed);
        let velocity = self.sab[attr_base + slot * ATTR_STRIDE + VELOCITY].load(Relaxed);
        let duration = self.sab[attr_base + slot * ATTR_STRIDE + DURATION].load(Relaxed);

        // 5. Synthesize
        self.render_node(pitch, velocity, duration, output);

        // 6. Follow chain
        slot = next as usize;
    }
}
```

**Audio thread guarantees:**
- **Never writes** to structural or attribute planes (pure reader)
- **Never blocks** — swap() is a single atomic instruction, cannot fail or retry
- **Never allocates** — all memory is pre-allocated
- **No conditional policy branches** — reads unconditionally

### 3.5 Main Thread Write Paths

**Data patch (instant — no swap needed):**

```rust
fn set_pitch(&self, slot: usize, pitch: i32) {
    self.attributes[slot].pitch.store(pitch, Relaxed);
    // Audio sees this on its very next atomic load.
    // No swap. No log. No dual-write. One store.
}
```

**Structural mutation (written to writer buffer):**

```rust
fn insert_head(&mut self, data: NodeData) -> usize {
    let slot = self.free_list.alloc().expect("node pool full");

    // Write attributes to shared plane (instant)
    self.sab[attr_base + slot * ATTR_STRIDE + PITCH].store(data.pitch, Relaxed);
    self.sab[attr_base + slot * ATTR_STRIDE + VELOCITY].store(data.velocity, Relaxed);

    // Write structure to WRITER buffer (not yet visible to audio)
    let writer_base = self.writer.current_start_index();
    let old_head = self.sab[writer_base + HEAD_OFFSET].load(Relaxed) as usize;
    self.sab[writer_base + slot * 2].store(old_head as i32, Relaxed);     // next
    self.sab[writer_base + slot * 2 + 1].store(NONE as i32, Relaxed);     // prev
    if old_head != NONE {
        self.sab[writer_base + old_head * 2 + 1].store(slot as i32, Relaxed); // prev
    }
    self.sab[writer_base + HEAD_OFFSET].store(slot as i32, Relaxed);

    slot
}
```

**Commit (publish structural changes):**

```rust
fn commit(&mut self) {
    // Publish writer buffer to shared (swap + sync in one call)
    self.writer.publish();

    // Process deferred slot returns
    for slot in self.deferred_frees.drain(..) {
        self.free_list.free(slot);
    }
}

> **Note:** `sync_stale_writer` is no longer a separate method. The sync
> (unsafe `copy_nonoverlapping`) is performed inside `publish()` using the
> locally captured `current_id` before the swap modifies the writer's buffer ID.


### 3.6 Memory Layout

```
Arena / Pre-allocated Memory:
┌─────────────────────────────────────────────────────────────┐
│ HEADER (16 bytes)                                           │
│  [0] TRIPLE_STATE      : AtomicI32 (packed buffer indices)  │
│  [1] PLAYHEAD_TICK     : AtomicI64                          │
│  [2] TRANSPORT_STATE   : AtomicU32                          │
├─────────────────────────────────────────────────────────────┤
│ FREE LISTS (shared metadata)                                │
│  ├─ NodeFreeList  { head, count, bitmap, chain }            │
│  └─ ModFreeList   { head, count, bitmap, chain }            │
├─────────────────────────────────────────────────────────────┤
│ SHARED ATTRIBUTE PLANE (single copy)              ~292 KB   │
│  ├─ Node attributes      4096 × 32B  = 128 KB              │
│  │   each: { pitch, velocity, duration, volume,             │
│  │           pan, channel, flags, reserved }                 │
│  ├─ Param values          1024 × 4B  =   4 KB              │
│  ├─ Mod configs           2048 × 16B =  32 KB              │
│  └─ LUT pool               128 × 1KB = 128 KB              │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER A                               ~104 KB   │
│  ├─ Node chain           4096 × 8B   =  32 KB              │
│  │   each: { next: i32, prev: i32 }                         │
│  ├─ Chain head                           4B                 │
│  ├─ Mod list heads       2048 × 4B   =   8 KB              │
│  └─ Synapse table        8192 × 8B   =  64 KB              │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER B (identical layout)            ~104 KB   │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER C (identical layout)            ~104 KB   │
├─────────────────────────────────────────────────────────────┤
│ AUDIO-OWNED ZONE (audio writes, main reads)       ~176 KB  │
│  ├─ smoothed_values[1024]   1024 × 4B  =   4 KB            │
│  ├─ smoothed_deltas[2048]   2048 × 4B  =   8 KB            │
│  ├─ fire_trace[8192]        8192 × 20B = 160 KB            │
│  └─ lfo_phases[1024]        1024 × 4B  =   4 KB            │
├─────────────────────────────────────────────────────────────┤
│ TOTAL                                             ~780 KB   │
└─────────────────────────────────────────────────────────────┘
```

### 3.7 Ownership Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                     OWNERSHIP MATRIX                                │
│                                                                     │
│  Region               │ Main Thread    │ Audio Thread               │
│  ──────────────────────┼────────────────┼────────────────            │
│  Attribute plane       │ WRITES         │ READS (atomic)             │
│  Structural WRITER buf │ WRITES         │ never touches              │
│  Structural SHARED buf │ swap only      │ swap only                  │
│  Structural READER buf │ never touches  │ READS                      │
│  Free list metadata    │ WRITES         │ never touches              │
│  Audio-owned zone      │ READS          │ WRITES                     │
│  ──────────────────────┼────────────────┼────────────────            │
│                                                                     │
│  INVARIANT: No memory region is written by both threads.            │
│  Every region has exactly one writer. SPSC per region.              │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.8 Slot Lifecycle

```
  ALLOCATE           POPULATE            LINK              PUBLISH
  ─────────         ──────────         ──────────         ──────────
  free_list          attributes         writer             writer
  .alloc()           [slot] =           buffer:            swap
  → slot 42          { pitch,           insert(42)
                      velocity,         into chain
                      ... }

      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
  ┌────────┐        ┌────────┐        ┌────────┐        ┌────────┐
  │ slot   │        │ attrs  │        │ writer │        │ shared │
  │ 42     │───────►│ ready  │───────►│ chain  │───────►│ buffer │
  │ owned  │        │ in     │        │ has    │        │ has    │
  │        │        │ shared │        │ slot   │        │ slot   │
  │        │        │ plane  │        │ 42     │        │ 42     │
  └────────┘        └────────┘        └────────┘        └────────┘

  ─────────────────────────────────────────────────────────────────

  REMOVE              UNLINK             PUBLISH           RECLAIM
  ─────────          ──────────         ──────────        ──────────
  mark slot           writer            writer             after swap:
  for deferred        buffer:           swap               free_list
  free                remove(42)                           .free(42)
                      from chain

      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
  ┌────────┐        ┌────────┐        ┌────────┐        ┌────────┐
  │ slot   │        │ writer │        │ published│       │ slot   │
  │ 42     │───────►│ chain  │───────►│ without  │──────►│ 42     │
  │ marked │        │ no     │        │ 42       │       │ back   │
  │ defer  │        │ slot   │        │          │       │ in     │
  │        │        │ 42     │        │          │       │ pool   │
  └────────┘        └────────┘        └────────┘        └────────┘

  NOTE: Attribute data at slot 42 is NOT cleared. The memory
  persists. Slot 42 just becomes available for reuse. When
  re-allocated, new attribute data overwrites old.
```

### 3.9 Insert Flow (Complete)

```
main: insert_head(NodeData { pitch: 570000, velocity: 100, ... })

  1. ALLOC
     slot = free_list.alloc() → 42

  2. ATTRIBUTES (shared plane, instant)
     attributes[42].pitch.store(570000, Relaxed)
     attributes[42].velocity.store(100, Relaxed)
     attributes[42].duration.store(480, Relaxed)

  3. STRUCTURE (writer buffer only, SAB indices)
     let writer_base = writer.current_start_index()
     sab[writer_base + 42 * 2].store(old_head)       // next
     sab[writer_base + 42 * 2 + 1].store(NONE)       // prev
     sab[writer_base + old_head * 2 + 1].store(42)    // if head exists
     sab[writer_base + HEAD_OFFSET].store(42)

  4. NOT YET VISIBLE TO AUDIO
     Audio reads READER buffer. Slot 42 is only in WRITER buffer.
     Audio cannot see it.

  5. COMMIT (when ready)
     writer.publish()  // swap + sync, ~10ns + ~4.7µs
     // Slot 42 now in SHARED buffer, audio picks it up next callback
```

### 3.10 Dropped Frame Semantics

```
SCENARIO: Main thread writes faster than audio reads

  Main:   write A → swap → write B → swap → write C → swap
  Audio:  ───────────────────────────────────────────── swap
                                                         │
                                                    reads C only

  Frames A and B were published to SHARED, then overwritten
  before audio consumed them. Audio only sees C — the latest.

  IS THIS A PROBLEM?

  For attributes:  NO  — pitch 440 → 441 → 442, audio sees 442. Correct.
  For structure:   NO  — insert A, then B, then C. Audio sees all three
                         in the latest frame. The FRAME contains the
                         cumulative state, not deltas.

  WHEN IT WOULD BE A PROBLEM:
  If frames were EVENTS (deltas), dropped frames = lost events.
  But frames are SNAPSHOTS (full state). Latest snapshot is always
  sufficient. No information is lost by skipping intermediate snapshots.
```

---

## 4. Trade-off Summary

```
┌────────────────────────────────────────────────────────────────────┐
│                     FINAL COMPARISON                               │
├───────────────────┬──────────────┬──────────────┬──────────────────┤
│ Dimension         │ Ring Buffer  │ Double-Buf   │ Triple-Buf Hybrid│
├───────────────────┼──────────────┼──────────────┼──────────────────┤
│ Audio mutates?    │ YES ✗        │ no           │ no               │
│ Audio blocks?     │ no           │ no           │ no               │
│ Writer blocks?    │ no           │ CONDITIONAL ✗│ no               │
│ Atomic reads      │ per-command  │ 1 load       │ 1 swap (~11ns)  │
│ Data patch latency│ next pop     │ instant      │ instant          │
│ Struct latency    │ next pop     │ next swap    │ next swap+swap   │
│ Consistency       │ per-command  │ per-frame    │ per-frame        │
│ Failure mode      │ overflow     │ SILENT ✗     │ visible          │
│ Correctness inv.  │ ~8           │ 5            │ 3                │
│ Sync cost         │ N/A          │ 150ns        │ ~4.7µs           │
│ Memory            │ ~700KB+ring  │ ~1.5MB       │ ~780KB           │
│ Write path        │ serialize+   │ dual-write+  │ single write     │
│                   │ push         │ log append   │                  │
│ Allocation?       │ ring is fixed│ no           │ no               │
│ Protocol code?    │ YES (enum,   │ log replay   │ swap protocol    │
│                   │  dispatch)   │              │ (well-tested)    │
├───────────────────┼──────────────┼──────────────┼──────────────────┤
│ VERDICT           │ REJECTED     │ REJECTED     │ SELECTED ✓       │
└───────────────────┴──────────────┴──────────────┴──────────────────┘
```

---

## 5. Costs We Accept

```
1. ~4.7µs unsafe memcpy on main thread after structural commit (benchmarked)
   Budget: milliseconds. Impact: negligible (0.03% of 16ms frame budget).

2. SoA cache pattern: 2 memory regions per node on audio thread
   Warm path (L1-hot): negligible.
   Cold path (after swap): ~500ns extra for 50 nodes. Once.

3. 3× structural memory (~312KB vs ~208KB for double-buffer)
   Absolute: ~104KB extra. Impact: none.

4. swap instead of plain atomic load on audio reader path
   ~11ns per callback. Single XCHG instruction, cannot fail or retry.

5. "Structural or attribute?" decision for every new field
   Binary test: "does corruption break traversal?" → structural.
   Everything else → attribute.

6. One unsafe block: copy_nonoverlapping for structural sync
   Idiomatic Rust (same pattern as Vec, HashMap internals).
   Bounded and verified by sentinel test (10K rounds, no corruption).
```

## 6. Structures (Rust, Preliminary)

> **Implementation deviation:** The TripleBuffer operates on the SAB (`Arc<Vec<AtomicI32>>`),
> not on stack-allocated `UnsafeCell<T>` buffers. All state — metadata slots, buffer indices,
> and structural data — lives as element indices into a flat `AtomicI32` array. This enables
> SAB reconstruction via `bind_writer()`/`bind_reader()` for hot-reload and crash recovery.

```rust
// SAB-based TripleBuffer (actual implementation)
type SAB = Arc<Vec<AtomicI32>>;

struct TripleBufferWriter {
    sab: SAB,
    state_slot_index: usize,       // AtomicI32 slot: bits [0:1]=shared, bit[2]=NEW_DATA
    writer_slot_index: usize,      // AtomicI32 slot: current writer buffer ID
    published_slot_index: usize,   // AtomicI32 slot: last published buffer ID
    buffer_bases: [usize; 3],      // start indices of each buffer region
    buffer_size: usize,            // elements per buffer
    end_index: usize,              // first index past the TripleBuffer's region
}

struct TripleBufferReader {
    sab: SAB,
    state_slot_index: usize,
    reader_slot_index: usize,      // AtomicI32 slot: current reader buffer ID
    buffer_bases: [usize; 3],
    buffer_size: usize,
    end_index: usize,
}

// Kernel (conceptual — not yet implemented)
struct Kernel {
    sab: SAB,
    writer: TripleBufferWriter,
    free_list: SimpleFreeList,
    mod_free_list: SimpleFreeList,
    lut_free_list: SimpleFreeList,
    deferred_frees: Vec<usize>,
    deferred_lut_frees: Vec<usize>,
}

// StructuralFrame is a region of the SAB, not a Rust struct.
// Its layout within each buffer:
//   [0..MAX_NODES*2]           node chain (next/prev pairs)
//   [MAX_NODES*2]              chain head
//   [MAX_NODES*2+1..+MAX_MODS] mod list heads
//   [remaining]                synapse table slots

struct NodeAttributes {
    pitch: AtomicI32,
    velocity: AtomicI32,
    duration: AtomicI32,
    volume: AtomicI32,
    pan: AtomicI32,
    channel: AtomicI32,
    flags: AtomicI32,
    _reserved: AtomicI32,
}

// Audio-owned zone (audio writes, main reads)
struct AudioZone {
    smoothed_values: [AtomicI32; MAX_PARAMS],
    smoothed_deltas: [AtomicI32; MAX_MODS],
    fire_trace: [FireEvent; TRACE_CAPACITY],
    lfo_phases: [AtomicI32; MAX_LFOS],
}
```

---

## 7. Open Questions for Implementation Phase

1. **Synapse table in structural plane:** The hash table contains routing topology. Resizing or rehashing requires a consistent snapshot. Confirm that the current capacity (8192 slots) is sufficient to avoid runtime resizing — resizing a triple-buffered hash table is complex.

2. **Free list thread safety:** Free list is exclusively owned by the main thread (alloc + deferred free return). Audio never touches it. Confirm this remains true if we add audio-side features (e.g., auto-release of finished notes).

3. **LUT pool in attribute plane:** LUTs are large (1KB each). If LUT content changes while audio reads it, we get a torn read across the LUT array (not a single atomic). Either LUTs need their own synchronization (e.g., treat LUT swaps as structural changes) or LUT content must be write-once.

4. **`published_snapshot` storage:** The sync step copies from the just-published buffer. Storing a dedicated snapshot avoids the question of "can I safely read from SHARED?" — though concurrent reads ARE safe, a local copy eliminates all ambiguity.

## Addendum: Resolved Design Decisions

*Resolves all open questions from Section 7 of the architecture document.*

---

### Decision 1: Synapse Table — Fixed Capacity, No Runtime Resize

**Resolution:** The synapse hash table is pre-allocated at kernel initialization with a configurable capacity. No runtime resizing.

**Rationale:** Resizing a triple-buffered hash table requires coordinated resize across writer, shared, and reader buffers simultaneously. The audio thread would read a table with a different capacity than expected, producing incorrect bucket lookups. This is structurally unsound.

**Implementation:**

```rust
struct KernelConfig {
    max_nodes: usize,          // default: 4096
    max_mods: usize,           // default: 2048
    synapse_capacity: usize,   // default: 8192
    lut_capacity: usize,       // default: 128
}

impl Kernel {
    fn new(config: KernelConfig) -> Self {
        // All capacities fixed at construction. No realloc. Ever.
    }
}
```

**Load factor monitoring:**

```
┌─────────────────────────────────────────────────────┐
│ Occupancy     │ Action                              │
│───────────────┼─────────────────────────────────────│
│ 0% – 70%     │ Normal operation                    │
│ 70% – 90%    │ Emit warning to host                │
│ 90%+         │ Reject new insertions, emit error   │
│───────────────┼─────────────────────────────────────│
│ Fix: re-init kernel with larger synapse_capacity    │
└─────────────────────────────────────────────────────┘
```

---

### Decision 2: Node Lifecycle — Main-Thread Owned, No Audio-Side Auto-Release

**Resolution:** No return ring buffer. No auto-release from the audio thread. Nodes are compositional structures with author-determined lifetimes, not transient voice allocations.

**Rationale:**

```
WRONG MENTAL MODEL (DAW-style):
  note-on → allocate voice → envelope finishes → free voice
  Audio thread detects "done" → returns slot

CORRECT MODEL (SymphonyScript):
  Node A: [a1, a2, a3, →B]     ← A composes B
  Node B: [b1, b2, →C]         ← B composes C
  Node C: [c1, c2, →A]         ← C loops to A (live show)

  Audio thread TRAVERSES nodes. It doesn't consume them.
  Node A isn't "done" when audio moves to B — A persists.
  It can be revisited (loops), referenced, or simply exist.
  
  Lifecycle is determined by the COMPOSER, not the PLAYER.
```

**Node creation and removal are exclusively main-thread operations:**

```
CREATE: user action → main thread → alloc slot → populate → commit
REMOVE: user action → main thread → unlink from writer → commit → deferred free
```

**Audio-to-main communication is limited to playback state in the audio-owned zone:**

```
AUDIO-OWNED ZONE:
  playback_cursor: { current_node: AtomicI32, note_index: AtomicI32 }
  transport_state: AtomicU32
  fire_trace: [...]
  lfo_phases: [...]
```

Main thread reads these atomically for UI feedback. No ring buffer. No slot returns from audio.

**Future exception — documented but not implemented:**

```
If real-time voice allocation is added (e.g., polyphonic synth
where each keypress spawns a voice), transient voices would use
a SEPARATE pool with a SEPARATE lifecycle, including an audio→main
return ring (SPSC, sized at max_voices, overflow structurally
impossible). This does NOT affect the compositional node graph.

Voice pool: transient, runtime-managed, audio can signal release
Node pool:  persistent, author-managed, audio never signals release
```

---

### Decision 3: LUT Pool — Write-Once Immutable Content

**Resolution:** LUT content is immutable after creation. To change a curve, allocate a new LUT slot, populate it, then atomically patch the referencing modulator's `lut_index` attribute.

**Rationale:** A LUT is 1KB (256 × f32). Writing it is 256 separate stores. Audio reading mid-write sees a torn curve — half new values, half old. This produces audible artifacts.

**Protocol:**

```
CHANGE A CURVE:

  1. Allocate new LUT slot
     new_slot = lut_free_list.alloc()

  2. Populate (safe — slot is not referenced by any node yet)
     lut_pool[new_slot] = new_curve_data   // 256 × f32

  3. Patch attribute (atomic, instant)
     mod_configs[mod].lut_index.store(new_slot, Relaxed)
     // Audio immediately reads from new LUT on next access

  4. Defer-free old slot
     deferred_lut_frees.push(old_slot)
     // Returned to LUT free list after next structural commit
     // (ensures audio has moved past the old reference)
```

```
TIMELINE:

  mod_configs[mod].lut_index = 7        (old curve)
       │
       ├─ lut_pool[12] = new_curve      (safe: slot 12 unreferenced)
       ├─ mod_configs[mod].lut_index.store(12)  (atomic switch)
       │
  mod_configs[mod].lut_index = 12       (new curve)
       │
       ├─ Audio reads lut_pool[12]       (complete, consistent curve)
       ├─ deferred: return slot 7 after next commit
```

**What this means for the LUT pool's placement:**

```
LUT pool stays in the SHARED ATTRIBUTE PLANE (single copy).
LUT content is never mutated in-place, so no torn reads.
No triple-buffering needed for LUTs.

Revised attribute plane:
  ├─ Node attributes     4096 × 32B  = 128 KB   (atomic per-field)
  ├─ Param values        1024 × 4B   =   4 KB   (atomic per-field)
  ├─ Mod configs         2048 × 16B  =  32 KB   (atomic per-field)
  └─ LUT pool             128 × 1KB  = 128 KB   (write-once, swap-by-index)
```

---

### Decision 4: Stale Writer Sync — Direct Copy from Published Buffer

**Resolution:** After the atomic swap, copy structural data directly from the just-published buffer to the new writer buffer. This is handled internally by `publish()`.

**Rationale:**

```
After publish()'s swap:
  WRITER  = stale buffer (just received from shared)
  SHARED  = just-published buffer (latest state)
  READER  = audio's current buffer

  The just-published buffer is either:
    a) In SHARED — nobody reads or writes it
    b) In READER — audio reads it

  In both cases: nobody WRITES to it.
  memcpy FROM it = concurrent read. Not a data race.
```

**Implementation:**

```rust
struct Kernel {
    sab: SAB,
    writer: TripleBufferWriter,
    // ...
}

fn commit(&mut self) {
    self.writer.publish();  // swap + sync in one call
    self.process_deferred_frees();
}
```

> **Implementation note:** `publish()` handles the atomic swap, the
> `published_slot_index` update, AND the stale writer sync (unsafe
> `copy_nonoverlapping`) in a single method call. The published buffer ID
> is captured as a local variable before the swap, making it immune to
> concurrent reader swaps.

**Why not a local snapshot:**

```
Local snapshot approach:
  1. memcpy writer → snapshot    (~104KB, ~4.7µs)
  2. swap
  3. memcpy snapshot → new writer (~104KB, ~4.7µs)
  Total: 2 copies, ~9.4µs, extra 104KB memory

Direct copy approach (implemented inside publish()):
  1. swap
  2. unsafe copy_nonoverlapping published → new writer (~104KB, ~4.7µs)
  Total: 1 copy, ~4.7µs, no extra memory

Direct copy is half the cost and zero extra memory.
The concurrent-read safety is trivially sound.
```

---

### Revised Memory Layout (Post-Addendum)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (16 bytes)                                           │
│  [0] TRIPLE_STATE      : AtomicI32                          │
│  [1] PLAYHEAD_TICK     : AtomicI64                          │
│  [2] TRANSPORT_STATE   : AtomicU32                          │
├─────────────────────────────────────────────────────────────┤
│ FREE LISTS (main-thread owned, audio never touches)         │
│  ├─ NodeFreeList  { head, count, bitmap, chain }            │
│  ├─ ModFreeList   { head, count, bitmap, chain }            │
│  └─ LutFreeList   { head, count, bitmap, chain }  ← NEW    │
├─────────────────────────────────────────────────────────────┤
│ SHARED ATTRIBUTE PLANE (single copy)              ~292 KB   │
│  ├─ Node attributes      4096 × 32B  = 128 KB              │
│  ├─ Param values          1024 × 4B  =   4 KB              │
│  ├─ Mod configs           2048 × 16B =  32 KB              │
│  └─ LUT pool (write-once)  128 × 1KB = 128 KB              │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER A (WRITER/SHARED/READER)        ~104 KB   │
│  ├─ Node chain pointers  4096 × 8B   =  32 KB              │
│  ├─ Chain head                           4B                 │
│  ├─ Mod list heads       2048 × 4B   =   8 KB              │
│  └─ Synapse table (fixed) 8192 × 8B  =  64 KB              │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER B (identical)                   ~104 KB   │
├─────────────────────────────────────────────────────────────┤
│ STRUCTURAL BUFFER C (identical)                   ~104 KB   │
├─────────────────────────────────────────────────────────────┤
│ AUDIO-OWNED ZONE (audio writes, main reads)       ~176 KB  │
│  ├─ playback_cursor       { node: i32, index: i32 }        │
│  ├─ smoothed_values[1024]  1024 × 4B  =   4 KB             │
│  ├─ smoothed_deltas[2048]  2048 × 4B  =   8 KB             │
│  ├─ fire_trace[8192]       8192 × 20B = 160 KB             │
│  └─ lfo_phases[1024]       1024 × 4B  =   4 KB             │
├─────────────────────────────────────────────────────────────┤
│ TOTAL                                             ~780 KB   │
└─────────────────────────────────────────────────────────────┘

No return ring buffer. No voice pool (future concern).
No local snapshot buffer. No structural log.
```

---

### Revised Ownership Matrix (Post-Addendum)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Region                │ Main Thread     │ Audio Thread              │
│───────────────────────┼─────────────────┼───────────────────────────│
│ Attribute plane       │ WRITES          │ READS (atomic per-field)  │
│ LUT pool (in attrs)   │ WRITE-ONCE only │ READS (by lut_index)     │
│ Structural WRITER     │ WRITES          │ never touches             │
│ Structural SHARED     │ swap only       │ swap only                 │
│ Structural READER     │ READS (sync)    │ READS                     │
│ Free lists (all)      │ WRITES          │ never touches             │
│ Audio-owned zone      │ READS           │ WRITES                    │
│───────────────────────┼─────────────────┼───────────────────────────│
│                                                                     │
│ INVARIANTS:                                                         │
│  1. No region is WRITTEN by both threads                            │
│  2. Structural READER may be read by BOTH threads (concurrent reads)│
│  3. LUT content is never mutated after initial write                │
│  4. Node lifecycle is exclusively main-thread controlled            │
└─────────────────────────────────────────────────────────────────────┘
```

**Unsafe boundary:**
The `unsafe` in the TripleBuffer is localized to a single `copy_nonoverlapping`
call inside `publish()`. The safety invariant:
- The writer has exclusive ownership of the stale buffer after the swap
- The source (just-published) buffer is in SHARED or READER position
- No thread writes to SHARED or READER buffers
- Bounds are validated at construction time
- Verified by sentinel test: 10K publish/swap rounds with no memory corruption

All unsafe is encapsulated inside the safe `pub fn publish(&mut self)` API.
Callers never use `unsafe`. This follows the same pattern as Rust's standard
library (`Vec`, `HashMap`, etc.): unsafe internals, safe public interface.

---

### Decision 5: Sparse Modulation Topology

Modulation should be per-attribute granular — "modulate pitch on node 42 with this envelope, modulate volume on node 42 with a different curve" — then baking `lut_index` into NodeAttributes is the wrong move. Here's why:

**Rationale:** If `lut_index` is stored directly on the node, it assumes either a 1:1 relationship (one curve per node, which is too restrictive) or a 1:N dense relationship (one curve index per modulatable attribute, which bloats the node's stride even when unused).

**Dense approach (lut_index in NodeAttributes):** You'd need one lut_index per modulatable attribute per node. Most nodes won't use most of them. You're paying stride cost on every node for slots that are overwhelmingly zero. And the stride grows with every new modulatable field.

**Sparse approach (LUT references in the mod system):** A modulator (ModConfig) holds its own `lut_index`. The synapse table routes that modulator to a specific [(node, attribute)](cci:1://file:///Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/kernel-rust/src/primitives/hash_table/probe_hash_table.rs:21:4-29:5) pair. Only nodes with active modulation pay the cost — and only for the attributes that are actually modulated.

- Node with no modulation → zero overhead
- Node with only pitch modulated → one mod entry, one synapse
- Node with 6 attributes modulated independently → 6 mod entries, 6 synapses

This scales exactly where the complexity is, rather than taxing every node uniformly.

**So for NodeAttributes:** slot 7 stays `_reserved`. No `lut_index`. The attribute plane is purely base values. All modulation routing — including LUT references — lives in ModConfig + SynapseTable, which are designed exactly for this kind of sparse, targeted topology.

This keeps NodeAttributes lean and the stride stable at 8, regardless of how sophisticated the modulation system becomes later.

By adopting a sparse approach:
1. `NodeAttributes` remains lean (strictly base parameters).
2. A `ModConfig` acts as the modulation source. It holds the `lut_index` (if table-driven) or LFO parameters.
3. The `SynapseTable` routes that `ModConfig` to a specific `(node, attribute)` pair.
4. Nodes with no modulation incur zero structural or processing overhead. Nodes with complex, multi-attribute modulation naturally scale in the topology without penalizing simple nodes.

**Resolution:** Automation and modulation data (such as LFO curves, envelope shapes, or automation lanes) are not intrinsic properties of a `Node`. Instead of storing a `lut_index` inside `NodeAttributes` (or elsewhere on the node), LUT binding and modulation routing live entirely within the `ModConfig` and `SynapseTable`.
