### Struct Inventory

**Core primitives:**

| Struct | What | Why |
|---|---|---|
| `TripleBuffer<T>` | Generic triple-buffer protocol. Holds 3 `UnsafeCell<T>`, one `AtomicU8` state, writer/reader indices. | The synchronization primitive. Reusable, domain-agnostic. All structural consistency flows through this. |
| `SimpleFreeList` | Bitmap-based slot allocator. Returns slot indices from a fixed-capacity pool. | Allocation without heap. Nodes, mods, and LUTs each get one. Main-thread-only, no atomics needed internally. |

**Structural plane (triple-buffered):**

| Struct | What | Why |
|---|---|---|
| `StructuralFrame` | One frame of structural state: node store, mod heads, synapse table. The `T` in `TripleBuffer<T>`. | The unit of atomic consistency. Writer builds a complete frame, swaps it, audio reads it whole. |
| `ChainNode` | Per-slot `{ next: i32, prev: i32 }`. Lives inside `StructuralFrame`. | Doubly-linked list traversal. Audio follows these pointers. 8 bytes, cache-friendly. |
| `SynapseTable` | Fixed-capacity probe hash table inside `StructuralFrame`. Maps `(source, target)` → routing data. | Modulation/signal routing topology. Structural because changing a route mid-read corrupts traversal. |

**Attribute plane (shared, single-copy):**

| Struct | What | Why |
|---|---|---|
| `NodeAttributes` | Per-slot atomic fields: pitch, velocity, duration, volume, pan, channel, flags, lut_index. | The data audio reads per-node. Atomic per-field, instantly patchable, no swap needed. |
| `ParamTable` | Flat array of `AtomicI32` values. Indexed by param ID. | Global parameters (tempo, master volume, etc). Single-writer atomic, instant reads. |
| `ModConfig` | Per-mod-slot atomic fields: source, depth, curve type, etc. | Modulator configuration. Attribute-plane because changing a mod's depth doesn't break graph traversal. |
| `LutPool` | Flat array of fixed-size LUT entries (e.g., 256 × f32 each). | Wavetables, envelope curves. Write-once content. Referenced by `lut_index` in `NodeAttributes`. |

**Audio-owned zone:**

| Struct | What | Why |
|---|---|---|
| `AudioZone` | Playback cursor, smoothed values, deltas, fire trace, LFO phases. All atomic. | Audio writes here, main reads for UI. Keeps audio-to-main feedback out of the triple-buffer path. |

**Top-level orchestrator:**

| Struct | What | Why |
|---|---|---|
| `Kernel` | Owns everything above. Exposes the public API: `insert`, `remove`, `patch`, `commit`. | Single entry point. Encapsulates all invariants. Callers never touch internals. |
| `KernelConfig` | Capacities: max_nodes, max_mods, synapse_capacity, lut_capacity. | Passed to `Kernel::new()`. All sizes fixed at construction. |
| `KernelReader` | Audio thread's handle. Holds reader-side index, reference to shared attribute plane and audio zone. | Separates the audio thread's API from the main thread's API at the type level. Audio can only call `reader_swap()` and read — cannot mutate. |

---

**Total: 13 structs.** Each has one clear responsibility. No struct needs to know about the internals of another — `Kernel` and `KernelReader` compose them.

The split between `Kernel` (main thread) and `KernelReader` (audio thread) is worth highlighting — it enforces thread ownership **at compile time.** The audio thread literally cannot call `insert()` or `patch()` because those methods don't exist on `KernelReader`. Rust's type system does what discipline can't.
